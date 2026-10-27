import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CrmStatus, Prisma } from '@prisma/client';
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

const MEDIA_LABEL: Record<string, string> = {
  image: '📷 Imagen',
  video: '🎥 Video',
  audio: '🎤 Audio',
  voice: '🎤 Audio',
  document: '📄 Documento',
  sticker: 'Sticker',
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
      webhookSigned: !!process.env.WHATSAPP_APP_SECRET,
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
        'Meta rechazó la plantilla. Revisá que esté aprobada (ver log del back).',
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
          const name = value.contacts?.find((c) => c.wa_id === m.from)?.profile
            ?.name;
          await this.saveInbound(m, name).catch((e) =>
            this.logger.error(`[CRM] Inbound ${m.id} failed:`, e),
          );
        }
        for (const s of value.statuses ?? []) {
          await this.saveStatus(s).catch((e) =>
            this.logger.error(`[CRM] Status ${s.id} failed:`, e),
          );
        }
      }
    }
  }

  private async saveInbound(m: WaInbound, contactName?: string) {
    const phone = normalizePhone(m.from);
    if (!phone) return;
    // Meta retries webhooks: the unique waMessageId makes this idempotent
    if (
      await this.prisma.waMessage.findUnique({
        where: { waMessageId: m.id },
        select: { id: true },
      })
    )
      return;

    const at = new Date(Number(m.timestamp) * 1000 || Date.now());
    const existing = await this.prisma.waConversation.findUnique({
      where: { phone },
      select: { id: true, gymId: true },
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
        gymId,
        status: 'OPEN',
        unreadCount: 1,
        lastMessageAt: at,
        lastInboundAt: at,
      },
      update: {
        ...(contactName && { contactName }),
        ...(gymId && !existing?.gymId && { gymId }),
        // A new message from the gym always needs our attention again
        status: 'OPEN',
        unreadCount: { increment: 1 },
        lastMessageAt: at,
        lastInboundAt: at,
      },
      select: { id: true },
    });

    await this.prisma.waMessage.create({
      data: {
        conversationId: conv.id,
        direction: 'IN',
        type: m.type,
        body: inboundText(m),
        waMessageId: m.id,
        createdAt: at,
      },
    });
  }

  private async saveStatus(s: WaStatus) {
    const msg = await this.prisma.waMessage.findUnique({
      where: { waMessageId: s.id },
      select: { id: true, status: true },
    });
    if (!msg) return;
    // Statuses can arrive out of order; never step back from read to delivered
    if (
      s.status !== 'failed' &&
      (STATUS_RANK[s.status] ?? 0) <= (STATUS_RANK[msg.status ?? ''] ?? 0)
    )
      return;
    const err = s.errors?.[0];
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
