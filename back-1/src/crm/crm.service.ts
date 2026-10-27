import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CrmStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  WhatsappService,
  normalizePhone,
} from '../notifications/whatsapp.service';
import { TEMPLATES } from '../notifications/whatsapp-templates';
import { UpdateConversationDto } from './dto/crm.dto';

/** Meta's customer service window: free-form replies only within 24 h of the contact's last message */
const WINDOW_MS = 24 * 60 * 60 * 1000;
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

const MEDIA_DIR = join(process.cwd(), 'uploads', 'wa-media');
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;
// Allow-list: anything else (html, svg…) is never written, so /uploads can't serve active content
const MEDIA_EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'application/pdf': 'pdf',
};

const GYM_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  subscriptionPlan: true,
  subscriptionStatus: true,
  whatsappPhone: true,
  owner: { select: { name: true, email: true } },
} satisfies Prisma.GymSelect;

// Shapes of the Meta webhook payload we use (entry[].changes[].value)
interface WaInbound {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: {
    button_reply?: { title: string };
    list_reply?: { title: string };
  };
  reaction?: { emoji?: string };
  location?: { latitude: number; longitude: number; name?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
}
interface WaStatus {
  id: string;
  status: string;
  errors?: { title?: string; message?: string; code?: number }[];
}
export interface WebhookPayload {
  entry?: { changes?: { value?: WaChangeValue }[] }[];
}
interface WaChangeValue {
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: WaInbound[];
  statuses?: WaStatus[];
}

// Shapes of the Zernio inbox webhooks we use (message.received / delivered / read / failed)
export interface ZernioWebhookPayload {
  event: string;
  message?: {
    conversationId: string;
    platform: string;
    platformMessageId: string;
    direction: 'incoming' | 'outgoing';
    text: string | null;
    attachments?: { type: string; url?: string }[];
    sender?: { id: string; name?: string; phoneNumber?: string | null };
    sentAt?: string;
  };
  account?: { accountId?: string };
  error?: { code?: number; title?: string; message?: string } | null;
}

/** Provider-neutral inbound message, what the CRM actually stores */
interface Inbound {
  waMessageId: string;
  from: string;
  contactName?: string;
  type: string;
  body: string;
  at: Date;
  externalId?: string;
}
interface StatusUpdate {
  waMessageId: string;
  status: string;
  error?: { title?: string; message?: string; code?: number };
}

const MEDIA_LABEL: Record<string, string> = {
  image: '📷 Imagen',
  video: '🎥 Video',
  audio: '🎤 Audio',
  voice: '🎤 Audio',
  document: '📄 Documento',
  sticker: 'Sticker',
  file: '📄 Documento',
};

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  config() {
    return {
      enabled: this.whatsapp.enabled,
      webhookSigned:
        !!process.env.ZERNIO_WEBHOOK_SECRET ||
        !!process.env.WHATSAPP_APP_SECRET,
    };
  }

  async summary() {
    const unread = await this.prisma.waConversation.count({
      where: { unreadCount: { gt: 0 }, status: { not: 'CLOSED' } },
    });
    return { unread };
  }

  async list(status?: string, q?: string) {
    const search = q?.trim();
    const where: Prisma.WaConversationWhereInput = {
      ...(status && status in CrmStatus ? { status: status as CrmStatus } : {}),
      ...(search
        ? {
            OR: [
              { phone: { contains: search.replace(/\D/g, '') || search } },
              { contactName: { contains: search, mode: 'insensitive' } },
              { gym: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.waConversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
      include: {
        gym: { select: { id: true, name: true, slug: true, logoUrl: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            body: true,
            direction: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    const counts = await this.prisma.waConversation.groupBy({
      by: ['status'],
      _count: true,
    });
    return {
      data: rows.map(({ messages, ...c }) => ({
        ...c,
        lastMessage: messages[0] ?? null,
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    };
  }

  async get(id: string) {
    const conv = await this.prisma.waConversation.findUnique({
      where: { id },
      include: {
        gym: { select: GYM_SELECT },
        messages: { orderBy: { createdAt: 'desc' }, take: 300 },
      },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    const [members, plan] = conv.gym
      ? await Promise.all([
          this.prisma.member.count({ where: { gymId: conv.gym.id } }),
          this.prisma.subscriptionPlan.findUnique({
            where: { key: conv.gym.subscriptionPlan },
            select: { label: true, maxMembers: true },
          }),
        ])
      : [0, null];

    return {
      ...conv,
      messages: conv.messages.reverse(),
      gym: conv.gym && { ...conv.gym, members, plan },
      windowOpen: this.windowOpen(conv.lastInboundAt),
    };
  }

  async markRead(id: string) {
    await this.assertExists(id);
    await this.prisma.waConversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
    return { ok: true };
  }

  async update(id: string, dto: UpdateConversationDto) {
    await this.assertExists(id);
    if (dto.gymId) {
      const gym = await this.prisma.gym.findUnique({
        where: { id: dto.gymId },
        select: { id: true },
      });
      if (!gym) throw new NotFoundException('Gimnasio no encontrado');
    }
    return this.prisma.waConversation.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes.trim() || null }),
        ...(dto.gymId !== undefined && { gymId: dto.gymId }),
      },
      select: { id: true, status: true, notes: true, gymId: true },
    });
  }

  /** Deletes the thread, its messages (cascade) and any stored attachments. */
  async remove(id: string) {
    await this.assertExists(id);
    const media = await this.prisma.waMessage.findMany({
      where: { conversationId: id, mediaUrl: { not: null } },
      select: { mediaUrl: true },
    });
    await this.prisma.waConversation.delete({ where: { id } });
    await Promise.all(
      media.map(({ mediaUrl }) =>
        unlink(join(MEDIA_DIR, mediaUrl!.split('/').pop()!)).catch(() => {}),
      ),
    );
    return { ok: true };
  }

  /** Opens (or reuses) the thread for a gym's WhatsApp number. Sending still needs a template. */
  async start(gymId: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true, whatsappPhone: true },
    });
    if (!gym) throw new NotFoundException('Gimnasio no encontrado');
    const phone = normalizePhone(gym.whatsappPhone);
    if (!phone)
      throw new BadRequestException('Este gimnasio no tiene WhatsApp cargado');
    const conv = await this.prisma.waConversation.upsert({
      where: { phone },
      create: { phone, gymId: gym.id, status: 'PENDING' },
      update: { gymId: gym.id },
      select: { id: true },
    });
    return conv;
  }

  async reply(id: string, body: string, adminId: string) {
    const conv = await this.assertExists(id);
    if (!this.windowOpen(conv.lastInboundAt)) {
      throw new ConflictException(
        'Pasaron más de 24 h desde el último mensaje del gym: WhatsApp solo permite escribirle con una plantilla.',
      );
    }
    const res = await this.whatsapp.sendText(conv.phone, body.trim(), adminId);
    if (!res.ok)
      throw new BadRequestException(res.error ?? 'No se pudo enviar');
    await this.prisma.waConversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
    return { ok: true };
  }

  /** Re-opens the 24 h window with the approved contact template. */
  async sendContactTemplate(id: string, adminId: string) {
    const conv = await this.prisma.waConversation.findUnique({
      where: { id },
      include: {
        gym: { select: { name: true, owner: { select: { name: true } } } },
      },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    const platform = await this.prisma.platformSettings.findFirst({
      select: { saasName: true },
    });
    const name =
      conv.gym?.owner?.name.split(' ')[0] ||
      conv.contactName?.split(' ')[0] ||
      'equipo';
    const ok = await this.whatsapp.sendTemplate(
      conv.phone,
      TEMPLATES.contact,
      [name, platform?.saasName ?? 'GymOS', conv.gym?.name ?? 'tu gimnasio'],
      adminId,
    );
    if (!ok)
      throw new BadRequestException(
        'WhatsApp rechazó la plantilla. Revisá que esté aprobada (ver log del back).',
      );
    return { ok: true };
  }

  // ── Webhook ────────────────────────────────────────────────

  async handleWebhook(payload: WebhookPayload) {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;
        for (const m of value.messages ?? []) {
          await this.saveInbound({
            waMessageId: m.id,
            from: m.from,
            contactName: value.contacts?.find((c) => c.wa_id === m.from)
              ?.profile?.name,
            type: m.type,
            body: inboundText(m),
            at: new Date(Number(m.timestamp) * 1000 || Date.now()),
          }).catch((e) =>
            this.logger.error(`[CRM] Inbound ${m.id} failed:`, e),
          );
        }
        for (const s of value.statuses ?? []) {
          await this.saveStatus({
            waMessageId: s.id,
            status: s.status,
            error: s.errors?.[0],
          }).catch((e) => this.logger.error(`[CRM] Status ${s.id} failed:`, e));
        }
      }
    }
  }

  async handleZernioWebhook(payload: ZernioWebhookPayload) {
    const m = payload.message;
    if (!m || m.platform !== 'whatsapp') return;
    // Only the number the CRM is wired to (the Zernio key may hold other accounts)
    const accountId = process.env.ZERNIO_WHATSAPP_ACCOUNT_ID;
    if (accountId && payload.account?.accountId !== accountId) return;

    if (payload.event === 'message.received' && m.direction === 'incoming') {
      // Users on a WhatsApp username may hide their number: sender.id is then a BSUID
      const from =
        m.sender?.phoneNumber ??
        (/^\d+$/.test(m.sender?.id ?? '') ? m.sender?.id : undefined);
      if (!from) {
        this.logger.warn(
          `[CRM] Zernio message ${m.platformMessageId} has no phone number, skipped`,
        );
        return;
      }
      const attachment = m.attachments?.[0];
      const media = attachment?.type;
      const label = media && (MEDIA_LABEL[media] ?? `[${media}]`);
      const saved = await this.saveInbound({
        waMessageId: m.platformMessageId,
        from,
        contactName: m.sender?.name,
        type: media ?? 'text',
        // Caption only; the CRM renders the media itself
        body: m.text ?? label ?? '[mensaje]',
        at: new Date(m.sentAt ?? Date.now()),
        externalId: m.conversationId,
      });
      // Meta drops inbound media after a while: keep a copy. Not awaited so the
      // webhook still answers within Zernio's 5 s; a redelivery retries it.
      if (saved && !saved.mediaUrl && attachment?.url) {
        void this.storeMedia(saved.id, attachment.url).catch((e) =>
          this.logger.error(
            `[CRM] Media for ${m.platformMessageId} failed:`,
            e,
          ),
        );
      }
      return;
    }

    const status = {
      'message.delivered': 'delivered',
      'message.read': 'read',
      'message.failed': 'failed',
    }[payload.event];
    if (status) {
      await this.saveStatus({
        waMessageId: m.platformMessageId,
        status,
        error: payload.error ?? undefined,
      });
    }
  }

  /** Returns the stored message (also when it was already there), or null if unusable. */
  private async saveInbound(m: Inbound) {
    const phone = normalizePhone(m.from);
    if (!phone) return null;
    // Webhooks get retried: the unique waMessageId makes this idempotent
    const dup = await this.prisma.waMessage.findUnique({
      where: { waMessageId: m.waMessageId },
      select: { id: true, mediaUrl: true },
    });
    if (dup) return dup;

    const { at, contactName, externalId } = m;
    const existing = await this.prisma.waConversation.findUnique({
      where: { phone },
      select: { id: true, gymId: true, externalId: true },
    });
    const gymId =
      existing?.gymId ??
      (
        await this.prisma.gym.findFirst({
          where: { whatsappPhone: phone },
          select: { id: true },
        })
      )?.id;

    const conv = await this.prisma.waConversation.upsert({
      where: { phone },
      create: {
        phone,
        contactName,
        externalId,
        gymId,
        status: 'OPEN',
        unreadCount: 1,
        lastMessageAt: at,
        lastInboundAt: at,
      },
      update: {
        ...(contactName && { contactName }),
        ...(gymId && !existing?.gymId && { gymId }),
        ...(externalId && !existing?.externalId && { externalId }),
        // A new message from the gym always needs our attention again
        status: 'OPEN',
        unreadCount: { increment: 1 },
        lastMessageAt: at,
        lastInboundAt: at,
      },
      select: { id: true },
    });

    return this.prisma.waMessage.create({
      data: {
        conversationId: conv.id,
        direction: 'IN',
        type: m.type,
        body: m.body,
        waMessageId: m.waMessageId,
        createdAt: at,
      },
      select: { id: true, mediaUrl: true },
    });
  }

  private async storeMedia(messageId: string, url: string) {
    // Zernio's media URL needs our API key: never send it anywhere else
    if (new URL(url).origin !== 'https://zernio.com') {
      this.logger.warn(`[CRM] Ignoring media from unexpected host: ${url}`);
      return;
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Zernio media → ${res.status}`);
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    const ext = MEDIA_EXT[type];
    if (!ext) {
      this.logger.warn(`[CRM] Unsupported media type "${type}", not stored`);
      return;
    }
    if (Number(res.headers.get('content-length') ?? 0) > MAX_MEDIA_BYTES) {
      this.logger.warn(`[CRM] Media too large, not stored`);
      return;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_MEDIA_BYTES) return;

    const name = `${randomUUID()}.${ext}`;
    await mkdir(MEDIA_DIR, { recursive: true });
    await writeFile(join(MEDIA_DIR, name), bytes);
    await this.prisma.waMessage.update({
      where: { id: messageId },
      data: { mediaUrl: `/uploads/wa-media/${name}` },
    });
  }

  private async saveStatus(s: StatusUpdate) {
    const msg = await this.prisma.waMessage.findUnique({
      where: { waMessageId: s.waMessageId },
      select: { id: true, status: true },
    });
    if (!msg) return;
    // Statuses can arrive out of order; never step back from read to delivered
    if (
      s.status !== 'failed' &&
      (STATUS_RANK[s.status] ?? 0) <= (STATUS_RANK[msg.status ?? ''] ?? 0)
    )
      return;
    const err = s.error;
    await this.prisma.waMessage.update({
      where: { id: msg.id },
      data: {
        status: s.status,
        ...(err && {
          error: `${err.message ?? err.title ?? 'Error'} (${err.code ?? '?'})`,
        }),
      },
    });
  }

  private windowOpen(lastInboundAt: Date | null) {
    return !!lastInboundAt && Date.now() - lastInboundAt.getTime() < WINDOW_MS;
  }

  private async assertExists(id: string) {
    const conv = await this.prisma.waConversation.findUnique({ where: { id } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv;
  }
}

function inboundText(m: WaInbound): string {
  switch (m.type) {
    case 'text':
      return m.text?.body ?? '';
    case 'button':
      return m.button?.text ?? '';
    case 'interactive':
      return (
        m.interactive?.button_reply?.title ??
        m.interactive?.list_reply?.title ??
        ''
      );
    case 'reaction':
      return `Reaccionó ${m.reaction?.emoji ?? ''}`.trim();
    case 'location':
      return `📍 ${m.location?.name ?? 'Ubicación'} (${m.location?.latitude}, ${m.location?.longitude})`;
    default: {
      const caption =
        m.image?.caption ??
        m.video?.caption ??
        m.document?.caption ??
        m.document?.filename;
      const label = MEDIA_LABEL[m.type] ?? `[${m.type}]`;
      return caption ? `${label}: ${caption}` : `${label} (abrilo en WhatsApp)`;
    }
  }
}
