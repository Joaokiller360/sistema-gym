import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CrmStatus, Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  WhatsappService,
  type WaTemplate,
  normalizePhone,
  parseWhatsapp,
} from '../notifications/whatsapp.service';
import { TEMPLATES } from '../notifications/whatsapp-templates';
import { SuperAdminService } from '../super-admin/super-admin.service';
import {
  CreateAccountDto,
  CreateTemplateDto,
  QuickReplyDto,
  SendAnyTemplateDto,
  StartConversationDto,
  UpdateConversationDto,
} from './dto/crm.dto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fileType = require('file-type') as {
  fromBuffer(buf: Buffer): Promise<{ ext: string; mime: string } | undefined>;
};

/** Meta's customer service window: free-form replies only within 24 h of the contact's last message */
const WINDOW_MS = 24 * 60 * 60 * 1000;
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
/** Admin replies wait this long before going out, so they can still be edited or taken back */
export const UNDO_MS = 60 * 1000;
// A send that never reported back (server restarted mid-request) is given up after this
const SENDING_STALE_MS = 5 * 60 * 1000;

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

const TEMPLATE_STATUS_ES: Record<string, string> = {
  PENDING: 'en revisión',
  IN_APPEAL: 'en apelación',
  REJECTED: 'rechazada',
  PAUSED: 'pausada',
  DISABLED: 'desactivada',
};

/** What the CRM can send, with WhatsApp's size caps */
const SENDABLE_MEDIA: Record<string, { type: 'image' | 'video'; max: number }> =
  {
    'image/jpeg': { type: 'image', max: 5 * 1024 * 1024 },
    'image/png': { type: 'image', max: 5 * 1024 * 1024 },
    'video/mp4': { type: 'video', max: 16 * 1024 * 1024 },
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
    private readonly storage: StorageService,
    private readonly superAdmin: SuperAdminService,
  ) {}

  async config() {
    const settings = await this.prisma.platformSettings.findFirst({
      select: { whatsappAlertsPaused: true },
    });
    return {
      enabled: this.whatsapp.enabled,
      webhookSigned:
        !!process.env.ZERNIO_WEBHOOK_SECRET ||
        !!process.env.WHATSAPP_APP_SECRET,
      alertsPaused: settings?.whatsappAlertsPaused ?? false,
    };
  }

  /** Pausing holds the plan-limit alerts back; they go out on the next check once resumed. */
  async setAlertsPaused(paused: boolean) {
    await this.prisma.platformSettings.upsert({
      where: { id: '1' },
      create: { id: '1', whatsappAlertsPaused: paused },
      update: { whatsappAlertsPaused: paused },
    });
    return { alertsPaused: paused };
  }

  profile() {
    return this.whatsapp.getBusinessProfile();
  }

  /** Meta takes a moment to serve the new photo, so the fresh profile may still show the old one */
  async setProfilePhoto(file: Express.Multer.File) {
    await this.whatsapp.setProfilePhoto(file);
    return this.whatsapp.getBusinessProfile();
  }

  async summary() {
    const unread = await this.prisma.waConversation.count({
      where: { unreadCount: { gt: 0 }, status: { not: 'CLOSED' } },
    });
    return { unread };
  }

  async list(status?: string, q?: string, tag?: string) {
    const search = q?.trim();
    const where: Prisma.WaConversationWhereInput = {
      ...(tag?.trim() && { tags: { has: tag.trim() } }),
      ...(status && status in CrmStatus ? { status: status as CrmStatus } : {}),
      ...(search
        ? {
            OR: [
              { phone: { contains: search.replace(/\D/g, '') || search } },
              { contactName: { contains: search, mode: 'insensitive' } },
              { alias: { contains: search, mode: 'insensitive' } },
              { tags: { has: search } },
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
        ...(dto.alias !== undefined && { alias: dto.alias.trim() || null }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.gymId !== undefined && { gymId: dto.gymId }),
        ...(dto.instantSend !== undefined && { instantSend: dto.instantSend }),
      },
      select: {
        id: true,
        instantSend: true,
        status: true,
        notes: true,
        alias: true,
        tags: true,
        gymId: true,
      },
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
      media.map(({ mediaUrl }) => this.storage.remove(mediaUrl)),
    );
    return { ok: true };
  }

  /** Opens (or reuses) the thread for a gym's WhatsApp number. Sending still needs a template. */
  async start(dto: StartConversationDto) {
    if (dto.gymId) return this.startForGym(dto.gymId);
    if (!dto.phone) throw new BadRequestException('Ingresá un número');
    const phone = parseWhatsapp(dto.phone)!;
    const alias = dto.name?.trim() || undefined;
    // Might be a customer already: link the gym like an inbound message would
    const gym = await this.prisma.gym.findFirst({
      where: { whatsappPhone: phone },
      select: { id: true },
    });
    const existing = await this.prisma.waConversation.findUnique({
      where: { phone },
      select: { id: true, alias: true },
    });
    if (existing) {
      if (alias && !existing.alias) {
        await this.prisma.waConversation.update({
          where: { id: existing.id },
          data: { alias },
        });
      }
      return { id: existing.id };
    }
    return this.prisma.waConversation.create({
      data: { phone, alias, gymId: gym?.id, status: 'PENDING' },
      select: { id: true },
    });
  }

  private async startForGym(gymId: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true, whatsappPhone: true },
    });
    if (!gym) throw new NotFoundException('Gimnasio no encontrado');
    if (!gym.whatsappPhone)
      throw new BadRequestException('Este gimnasio no tiene WhatsApp cargado');
    const phone = normalizePhone(gym.whatsappPhone);
    if (!phone)
      throw new BadRequestException(
        `El WhatsApp del gimnasio (${gym.whatsappPhone}) no tiene código de país: corregilo en "Editar"`,
      );
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
    // Queued, not sent: flushQueued() delivers it once the undo window is over.
    // Contacts with instantSend skip the queue.
    const msg = await this.prisma.waMessage.create({
      data: {
        conversationId: id,
        direction: 'OUT',
        type: 'text',
        body: body.trim(),
        sentById: adminId,
        status: conv.instantSend ? 'sending' : 'queued',
      },
      select: { id: true, body: true, sentById: true, createdAt: true },
    });
    await this.prisma.waConversation.update({
      where: { id },
      data: { unreadCount: 0, lastMessageAt: msg.createdAt },
    });
    if (conv.instantSend) {
      await this.deliver({ ...msg, conversation: conv });
      return { ok: true, id: msg.id, sendAt: msg.createdAt };
    }
    return {
      ok: true,
      id: msg.id,
      sendAt: new Date(msg.createdAt.getTime() + UNDO_MS),
    };
  }

  /** Skips what's left of the undo window for one queued reply. */
  async sendNow(id: string, messageId: string) {
    const { count } = await this.prisma.waMessage.updateMany({
      where: { id: messageId, conversationId: id, status: 'queued' },
      data: { status: 'sending' },
    });
    if (!count) throw new ConflictException('El mensaje ya se envió.');
    const m = await this.prisma.waMessage.findUniqueOrThrow({
      where: { id: messageId },
      include: {
        conversation: { select: { phone: true, lastInboundAt: true } },
      },
    });
    await this.deliver(m);
    return { ok: true };
  }

  /** Photo or video with an optional caption. Goes out right away: no undo queue. */
  async sendMedia(
    id: string,
    file: Express.Multer.File,
    caption: string | undefined,
    adminId: string,
  ) {
    const conv = await this.assertExists(id);
    if (!this.windowOpen(conv.lastInboundAt)) {
      throw new ConflictException(
        'Pasaron más de 24 h desde su último mensaje: WhatsApp solo permite escribirle con una plantilla.',
      );
    }
    // Trust the bytes, not the browser's mimetype
    const detected = await fileType.fromBuffer(file.buffer.subarray(0, 4100));
    const kind = detected && SENDABLE_MEDIA[detected.mime];
    if (!kind) throw new BadRequestException('Solo fotos JPG/PNG o videos MP4');
    if (file.size > kind.max) {
      throw new BadRequestException(
        `WhatsApp acepta hasta ${kind.max / 1024 / 1024} MB para ${kind.type === 'image' ? 'fotos' : 'videos'}`,
      );
    }

    const publicUrl = await this.whatsapp.uploadMedia({
      buffer: file.buffer,
      mimetype: detected.mime,
      originalname: `${randomUUID()}.${detected.ext}`,
    });
    // Local copy so the thread keeps showing it after Zernio's link expires
    const mediaUrl = await this.storage.put(
      `wa-media/${randomUUID()}.${detected.ext}`,
      file.buffer,
      detected.mime,
    );
    const text = caption?.trim() || undefined;
    const msg = await this.prisma.waMessage.create({
      data: {
        conversationId: id,
        direction: 'OUT',
        type: kind.type,
        body: text ?? (kind.type === 'image' ? '📷 Imagen' : '🎥 Video'),
        mediaUrl,
        sentById: adminId,
        status: 'sending',
      },
      select: { id: true },
    });
    await this.prisma.waConversation.update({
      where: { id },
      data: { unreadCount: 0, lastMessageAt: new Date() },
    });
    const res = await this.whatsapp.sendMedia(
      conv.phone,
      { type: kind.type, url: publicUrl, caption: text },
      adminId,
      msg.id,
    );
    if (!res.ok)
      throw new BadRequestException(res.error ?? 'No se pudo enviar');
    return { ok: true, id: msg.id };
  }

  async editQueued(id: string, messageId: string, body: string) {
    const { count } = await this.prisma.waMessage.updateMany({
      where: { id: messageId, conversationId: id, status: 'queued' },
      data: { body: body.trim() },
    });
    if (!count)
      throw new ConflictException(
        'El mensaje ya se envió: no se puede editar.',
      );
    return { ok: true };
  }

  async deleteQueued(id: string, messageId: string) {
    const { count } = await this.prisma.waMessage.deleteMany({
      where: { id: messageId, conversationId: id, status: 'queued' },
    });
    if (!count)
      throw new ConflictException(
        'El mensaje ya se envió: no se puede eliminar.',
      );
    return { ok: true };
  }

  @Interval(5000)
  async flushQueued() {
    const now = Date.now();
    await this.prisma.waMessage.updateMany({
      where: {
        status: 'sending',
        createdAt: { lt: new Date(now - UNDO_MS - SENDING_STALE_MS) },
      },
      data: { status: 'failed', error: 'No se pudo confirmar el envío' },
    });
    const due = await this.prisma.waMessage.findMany({
      where: { status: 'queued', createdAt: { lte: new Date(now - UNDO_MS) } },
      orderBy: { createdAt: 'asc' },
      take: 20,
      include: {
        conversation: { select: { phone: true, lastInboundAt: true } },
      },
    });
    for (const m of due) {
      // Claim it first so a second instance (or a slow tick) can't send it twice
      const { count } = await this.prisma.waMessage.updateMany({
        where: { id: m.id, status: 'queued' },
        data: { status: 'sending' },
      });
      if (count) await this.deliver(m);
    }
  }

  /** Sends a reply already claimed as 'sending'. Never throws. */
  private async deliver(m: {
    id: string;
    body: string;
    sentById: string | null;
    conversation: { phone: string; lastInboundAt: Date | null };
  }) {
    if (!this.windowOpen(m.conversation.lastInboundAt)) {
      await this.prisma.waMessage.update({
        where: { id: m.id },
        data: {
          status: 'failed',
          error: 'Se cerró la ventana de 24 h antes del envío',
        },
      });
      return;
    }
    const res = await this.whatsapp
      .sendText(m.conversation.phone, m.body, m.sentById ?? undefined, m.id)
      .catch((e) => {
        this.logger.error(`[CRM] Reply ${m.id} failed:`, e);
        return { ok: false, error: 'No se pudo enviar' };
      });
    // Rejected before reaching WhatsApp (not configured, bad number): nothing logged it
    if (!res.ok)
      await this.prisma.waMessage.updateMany({
        where: { id: m.id, status: 'sending' },
        data: { status: 'failed', error: res.error ?? 'No se pudo enviar' },
      });
  }

  /** With a conversation, each template carries the values the CRM already knows for that contact. */
  async templates(conversationId?: string) {
    const [templates, known]: [
      WaTemplate[],
      Record<string, Array<string | number>>,
    ] = await Promise.all([
      this.whatsapp.listTemplates(),
      conversationId ? this.templateDefaults(conversationId) : {},
    ]);
    return templates.map((t) => ({
      ...t,
      // Which built-in send uses it (contact/offer buttons, automatic alerts)
      system:
        (Object.entries(TEMPLATES).find(([, name]) => name === t.name)?.[0] as
          | keyof typeof TEMPLATES
          | undefined) ?? null,
      defaults: Array.from({ length: t.params }, (_, i) =>
        String(known[t.name]?.[i] ?? ''),
      ),
    }));
  }

  /**
   * Values for our own templates, same order the automatic sends use.
   * Unknown ones (no gym linked, no plan limit) stay empty for the team to fill.
   */
  private async templateDefaults(
    id: string,
  ): Promise<Record<string, Array<string | number>>> {
    const conv = await this.prisma.waConversation.findUnique({
      where: { id },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            subscriptionPlan: true,
            owner: { select: { name: true } },
          },
        },
      },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    const platform = await this.prisma.platformSettings.findFirst({
      select: { saasName: true },
    });
    const saas = platform?.saasName ?? 'GymOS';
    const gym = conv.gym;
    const name =
      gym?.owner?.name.split(' ')[0] ||
      conv.alias?.split(' ')[0] ||
      conv.contactName?.split(' ')[0] ||
      '';
    if (!gym) {
      return {
        [TEMPLATES.contact]: [name, saas],
        [TEMPLATES.offer]: [name, saas],
      };
    }
    const [members, plan] = await Promise.all([
      this.prisma.member.count({ where: { gymId: gym.id } }),
      this.prisma.subscriptionPlan.findUnique({
        where: { key: gym.subscriptionPlan },
        select: { label: true, maxMembers: true },
      }),
    ]);
    const max = plan?.maxMembers ?? '';
    const pct = plan?.maxMembers
      ? Math.floor((members / plan.maxMembers) * 100)
      : '';
    return {
      [TEMPLATES.limitWarning]: [
        name,
        gym.name,
        pct,
        members,
        max,
        plan?.label ?? '',
      ],
      [TEMPLATES.limitReached]: [name, gym.name, max, plan?.label ?? ''],
      [TEMPLATES.contact]: [name, saas, gym.name],
      [TEMPLATES.offer]: [name, saas],
    };
  }

  /** Any approved template, values filled in the CRM. Works with the window closed too. */
  async sendTemplate(id: string, dto: SendAnyTemplateDto, adminId: string) {
    const conv = await this.assertExists(id);
    const template = (await this.whatsapp.listTemplates()).find(
      (t) => t.name === dto.name && t.language === dto.language,
    );
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    if (template.status !== 'APPROVED')
      throw new ConflictException(
        'La plantilla todavía no está aprobada por WhatsApp',
      );
    if (template.unsupported)
      throw new BadRequestException(template.unsupported);
    const params = dto.params.map((p) => p.trim());
    if (params.length !== template.params || params.some((p) => !p)) {
      throw new BadRequestException(
        `Completá los ${template.params} valores de la plantilla`,
      );
    }
    const res = await this.whatsapp.sendAnyTemplate(
      conv.phone,
      {
        name: template.name,
        language: template.language,
        params,
        body: template.preview,
      },
      adminId,
    );
    if (!res.ok)
      throw new BadRequestException(
        res.error ?? 'WhatsApp rechazó la plantilla',
      );
    return { ok: true };
  }

  /** Our own template: checks Meta's basic rules here so the error is readable */
  async createTemplate(dto: CreateTemplateDto) {
    const body = dto.body.trim();
    const vars = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const count = vars.length ? Math.max(...vars) : 0;
    if (vars.some((n, i) => n !== i + 1)) {
      throw new BadRequestException(
        'Las variables tienen que ir en orden y sin repetir: {{1}}, {{2}}, {{3}}…',
      );
    }
    if (/^\s*\{\{\d+\}\}/.test(body) || /\{\{\d+\}\}\s*[.!?]?\s*$/.test(body)) {
      throw new BadRequestException(
        'WhatsApp no acepta que el mensaje empiece o termine con una variable',
      );
    }
    const examples = (dto.examples ?? []).map((e) => e.trim());
    if (examples.length !== count || examples.some((e) => !e)) {
      throw new BadRequestException(
        `Poné un ejemplo para cada variable (${count}): WhatsApp los usa para revisarla`,
      );
    }
    const taken = (await this.whatsapp.listTemplates()).some(
      (t) => t.name === dto.name && t.language === dto.language,
    );
    if (taken)
      throw new ConflictException('Ya existe una plantilla con ese nombre');
    return this.whatsapp.createTemplate({
      name: dto.name,
      category: dto.category,
      language: dto.language,
      body,
      examples,
      footer: dto.footer?.trim() || undefined,
    });
  }

  async deleteTemplate(name: string, language: string) {
    // The automatic alerts and the contact buttons depend on these
    if (Object.values(TEMPLATES).includes(name)) {
      throw new ConflictException(
        'Esta plantilla la usan los avisos automáticos: no se puede eliminar',
      );
    }
    await this.whatsapp.deleteTemplate(name, language);
    return { ok: true };
  }

  /**
   * Gym + owner login for the contact of this chat, linked to it. The owner also gets
   * the welcome email; with the window open the login goes by WhatsApp too.
   * The password is returned once so the team can pass it on; the CRM log hides it.
   */
  async createAccount(id: string, dto: CreateAccountDto, adminId: string) {
    const conv = await this.assertExists(id);
    if (conv.gymId) {
      throw new ConflictException(
        'Este contacto ya tiene un gimnasio vinculado',
      );
    }
    const email = dto.email.trim().toLowerCase();
    // createGym takes over an existing user (new password and role): never from a chat
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException('Ya existe un usuario con ese email');
    if (dto.plan) {
      const plan = await this.prisma.subscriptionPlan.findFirst({
        where: { key: dto.plan },
        select: { key: true },
      });
      if (!plan) throw new BadRequestException('Plan inexistente');
    }

    const gymName = dto.gymName.trim();
    const ownerName = dto.ownerName.trim();
    const password = randomBytes(12).toString('base64url');
    const gym = (await this.superAdmin.createGym({
      name: gymName,
      slug: await this.freeSlug(gymName),
      ...(dto.plan && { subscriptionPlan: dto.plan }),
      whatsappPhone: `+${conv.phone}`,
      owner: { name: ownerName, email, password },
    })) as { id: string; slug: string };
    await this.prisma.waConversation.update({
      where: { id },
      data: { gymId: gym.id },
    });

    let whatsapp: { sent: boolean; error?: string } | null = null;
    if (dto.sendWhatsapp && this.windowOpen(conv.lastInboundAt)) {
      const platform = await this.prisma.platformSettings.findFirst({
        select: { saasName: true },
      });
      const url = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
        .split(',')[0]
        .trim()
        .replace(/\/$/, '');
      const text = (pass: string) =>
        `¡Listo, ${ownerName.split(' ')[0]}! Ya creamos la cuenta de *${gymName}* en ${platform?.saasName ?? 'GymOS'}.\n\n` +
        `Entrá en ${url}/login\nUsuario: ${email}\nContraseña: ${pass}\n\n` +
        'Te recomendamos cambiar la contraseña después de entrar.';
      // Saved without the password; WhatsApp gets the real one
      const msg = await this.prisma.waMessage.create({
        data: {
          conversationId: id,
          direction: 'OUT',
          type: 'text',
          body: text('••••••••'),
          sentById: adminId,
          status: 'sending',
        },
        select: { id: true },
      });
      const res = await this.whatsapp.sendText(
        conv.phone,
        text(password),
        adminId,
        msg.id,
      );
      whatsapp = { sent: res.ok, error: res.error };
    }
    return { gymId: gym.id, slug: gym.slug, email, password, whatsapp };
  }

  /** Slug from the gym name, with -2, -3… when taken */
  private async freeSlug(name: string) {
    const base =
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'gym';
    for (let i = 1; ; i++) {
      const slug = i === 1 ? base : `${base}-${i}`;
      const taken = await this.prisma.gym.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!taken) return slug;
    }
  }

  // ── Quick replies ──────────────────────────────────────────

  quickReplies() {
    return this.prisma.crmQuickReply.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, label: true, text: true },
    });
  }

  async createQuickReply(dto: QuickReplyDto) {
    const last = await this.prisma.crmQuickReply.aggregate({
      _max: { position: true },
    });
    return this.prisma.crmQuickReply.create({
      data: {
        label: dto.label.trim(),
        text: dto.text.trim(),
        position: (last._max.position ?? -1) + 1,
      },
      select: { id: true, label: true, text: true },
    });
  }

  async updateQuickReply(id: string, dto: QuickReplyDto) {
    const { count } = await this.prisma.crmQuickReply.updateMany({
      where: { id },
      data: { label: dto.label.trim(), text: dto.text.trim() },
    });
    if (!count) throw new NotFoundException('Respuesta no encontrada');
    return { ok: true };
  }

  async deleteQuickReply(id: string) {
    await this.prisma.crmQuickReply.deleteMany({ where: { id } });
    return { ok: true };
  }

  /** Re-opens the 24 h window with the approved contact template. */
  async sendContactTemplate(
    id: string,
    adminId: string,
    kind?: 'contact' | 'offer',
  ) {
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
      conv.alias?.split(' ')[0] ||
      conv.contactName?.split(' ')[0] ||
      'equipo';
    const saas = platform?.saasName ?? 'GymOS';
    const offer = (kind ?? (conv.gym ? 'contact' : 'offer')) === 'offer';
    const template = offer ? TEMPLATES.offer : TEMPLATES.contact;
    await this.assertApproved(template);
    const ok = await this.whatsapp.sendTemplate(
      conv.phone,
      template,
      offer
        ? [name === 'equipo' ? 'qué tal' : name, saas]
        : [name, saas, conv.gym?.name ?? 'tu gimnasio'],
      adminId,
    );
    if (!ok)
      throw new BadRequestException(
        `WhatsApp rechazó la plantilla ${template}. Revisá que esté aprobada (ver log del back).`,
      );
    return { ok: true };
  }

  /**
   * Checked before sending, so a missing or unapproved template never goes out
   * (nor leaves a failed message in the chat). Meta direct can't list: skipped there.
   */
  private async assertApproved(template: string) {
    if (!this.whatsapp.viaZernio) return;
    const language = process.env.WHATSAPP_TEMPLATE_LANG ?? 'es';
    const found = (await this.whatsapp.listTemplates()).find(
      (t) => t.name === template && t.language === language,
    );
    if (!found) {
      throw new ConflictException(
        `No se envió: la plantilla ${template} no existe en tu cuenta de WhatsApp. Creala desde "Otra plantilla › Nueva plantilla" con ese nombre y esperá a que la aprueben.`,
      );
    }
    if (found.status !== 'APPROVED') {
      throw new ConflictException(
        `No se envió: la plantilla ${template} está ${TEMPLATE_STATUS_ES[found.status] ?? found.status.toLowerCase()} en WhatsApp.`,
      );
    }
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

    const mediaUrl = await this.storage.put(
      `wa-media/${randomUUID()}.${ext}`,
      bytes,
      type,
    );
    await this.prisma.waMessage.update({
      where: { id: messageId },
      data: { mediaUrl },
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
