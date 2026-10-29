import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { renderTemplate } from './whatsapp-templates';

/** Positional body parameters, in the order the template declares {{1}}, {{2}}, … */
export type TemplateParams = Array<string | number>;

export interface SendResult {
  ok: boolean;
  waMessageId?: string;
  /** Zernio inbox thread the message went to */
  conversationId?: string;
  error?: string;
}

type TemplateOutbound = {
  type: 'template';
  name: string;
  params: TemplateParams;
  /** Defaults to WHATSAPP_TEMPLATE_LANG */
  language?: string;
  /** Approved body with {{n}} holes, for templates without a local copy */
  body?: string;
};
type MediaOutbound = {
  type: 'image' | 'video';
  /** Public URL WhatsApp downloads the file from */
  url: string;
  caption?: string;
};
type Outbound =
  | { type: 'text'; body: string }
  | TemplateOutbound
  | MediaOutbound;

/** Same labels the CRM shows for media without a caption */
const MEDIA_LABEL = { image: '📷 Imagen', video: '🎥 Video' };

/** Approved template as the CRM picker needs it */
export interface WaTemplate {
  name: string;
  language: string;
  category: string;
  /** APPROVED, PENDING, REJECTED, PAUSED…: only APPROVED can be sent */
  status: string;
  /** Header text (if any) + body, with {{n}} holes */
  preview: string;
  /** Values to fill, in Zernio's flat order: header vars, then body vars */
  params: number;
  /** Media headers and dynamic buttons need values the CRM can't provide yet */
  unsupported: string | null;
}

type ZernioTemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type?: string; url?: string }>;
};

/** Highest {{n}} in a template text */
function holes(text = '') {
  return Math.max(
    0,
    ...[...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])),
  );
}

const ZERNIO_API = 'https://zernio.com/api/v1';

type ZernioError = { error?: string | { message?: string }; message?: string };

function zernioReason(data: ZernioError | null) {
  return (
    (typeof data?.error === 'string' ? data.error : data?.error?.message) ??
    data?.message
  );
}

/**
 * WhatsApp sender. Goes through Zernio when ZERNIO_API_KEY is set (the number is
 * connected there), otherwise straight to Meta's Cloud API. Business-initiated
 * messages must use an approved template; see docs/whatsapp-templates.md.
 * Every sent message is also logged in the CRM conversation for that number.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly prisma: PrismaService) {}

  get viaZernio() {
    return (
      !!process.env.ZERNIO_API_KEY && !!process.env.ZERNIO_WHATSAPP_ACCOUNT_ID
    );
  }

  get enabled() {
    return (
      this.viaZernio ||
      (!!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID)
    );
  }

  /** Returns true when the message was accepted. Never throws. */
  async sendTemplate(
    to: string,
    template: string,
    params: TemplateParams,
    sentById?: string,
  ): Promise<boolean> {
    const res = await this.send(
      to,
      { type: 'template', name: template, params },
      sentById,
    );
    return res.ok;
  }

  /** Any approved template, picked in the CRM. Never throws. */
  sendAnyTemplate(
    to: string,
    template: Omit<TemplateOutbound, 'type'>,
    sentById?: string,
  ): Promise<SendResult> {
    return this.send(to, { type: 'template', ...template }, sentById);
  }

  /** Photo or video by public URL (see uploadMedia). Same 24 h rule as text. */
  sendMedia(
    to: string,
    media: Omit<MediaOutbound, 'type'> & { type: MediaOutbound['type'] },
    sentById?: string,
    messageId?: string,
  ): Promise<SendResult> {
    return this.send(to, media, sentById, messageId);
  }

  /** Puts the file on Zernio's storage and returns the public URL WhatsApp fetches it from. */
  async uploadMedia(file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
  }) {
    this.assertZernio();
    const res = await fetch(`${ZERNIO_API}/media/presign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.originalname,
        contentType: file.mimetype,
        size: file.buffer.length,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as
      | (ZernioError & {
          uploadUrl?: string;
          publicUrl?: string;
        })
      | null;
    if (!res.ok || !data?.uploadUrl || !data.publicUrl) {
      throw this.zernioFailure('media presign', res.status, data);
    }
    const put = await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.mimetype },
      body: new Uint8Array(file.buffer),
      signal: AbortSignal.timeout(120_000),
    });
    if (!put.ok) {
      this.logger.error(`[WhatsApp/Zernio] media upload → ${put.status}`);
      throw new BadRequestException(
        `No se pudo subir el archivo (${put.status})`,
      );
    }
    return data.publicUrl;
  }

  /** Every template of the connected number, whatever its review status. Only through Zernio. */
  async listTemplates(): Promise<WaTemplate[]> {
    this.assertZernio();
    const params = new URLSearchParams({
      accountId: process.env.ZERNIO_WHATSAPP_ACCOUNT_ID!,
    });
    const res = await fetch(`${ZERNIO_API}/whatsapp/templates?${params}`, {
      headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as
      | (ZernioError & {
          templates?: Array<{
            name?: string;
            language?: string;
            category?: string;
            status?: string;
            components?: ZernioTemplateComponent[];
          }>;
        })
      | null;
    if (!res.ok) throw this.zernioFailure('templates', res.status, data);
    return (data?.templates ?? [])
      .filter((t) => t.name)
      .map((t) => {
        const find = (type: string) =>
          t.components?.find((c) => c.type?.toUpperCase() === type);
        const header = find('HEADER');
        const body = find('BODY');
        const textHeader =
          header && (header.format ?? 'TEXT').toUpperCase() === 'TEXT';
        const dynamicButton = find('BUTTONS')?.buttons?.some((b) =>
          b.url?.includes('{{'),
        );
        return {
          name: t.name!,
          language: t.language ?? 'es',
          category: t.category ?? '',
          status: (t.status ?? 'PENDING').toUpperCase(),
          preview: [textHeader ? header.text : null, body?.text]
            .filter(Boolean)
            .join('\n\n'),
          params: (textHeader ? holes(header.text) : 0) + holes(body?.text),
          unsupported:
            header && !textHeader
              ? 'Tiene encabezado con imagen, video o documento'
              : dynamicButton
                ? 'Tiene un botón con link variable'
                : null,
        };
      });
  }

  /** Submits a new template to Meta; it comes back PENDING until reviewed (up to 24 h). */
  async createTemplate(t: {
    name: string;
    category: 'UTILITY' | 'MARKETING';
    language: string;
    body: string;
    /** One sample value per {{n}}, required by Meta's review */
    examples: string[];
    footer?: string;
  }) {
    this.assertZernio();
    const res = await fetch(`${ZERNIO_API}/whatsapp/templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId: process.env.ZERNIO_WHATSAPP_ACCOUNT_ID,
        name: t.name,
        category: t.category,
        language: t.language,
        components: [
          {
            type: 'body',
            text: t.body,
            ...(t.examples.length && {
              example: { body_text: [t.examples] },
            }),
          },
          ...(t.footer ? [{ type: 'footer', text: t.footer }] : []),
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => null)) as
      | (ZernioError & { template?: { status?: string } })
      | null;
    if (!res.ok) throw this.zernioFailure('create template', res.status, data);
    return { status: data?.template?.status ?? 'PENDING' };
  }

  async deleteTemplate(name: string, language: string) {
    this.assertZernio();
    const params = new URLSearchParams({
      accountId: process.env.ZERNIO_WHATSAPP_ACCOUNT_ID!,
      language,
    });
    const res = await fetch(
      `${ZERNIO_API}/whatsapp/templates/${encodeURIComponent(name)}?${params}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = (await res.json().catch(() => null)) as ZernioError | null;
    if (!res.ok) throw this.zernioFailure('delete template', res.status, data);
  }

  /**
   * Free-form text; WhatsApp only delivers it within 24 h of the contact's last message.
   * `messageId` points at a CRM message already saved (queued reply) to update instead of logging a new one.
   */
  sendText(
    to: string,
    body: string,
    sentById?: string,
    messageId?: string,
  ): Promise<SendResult> {
    return this.send(to, { type: 'text', body }, sentById, messageId);
  }

  private async send(
    to: string,
    msg: Outbound,
    sentById?: string,
    messageId?: string,
  ): Promise<SendResult> {
    const body =
      msg.type === 'template'
        ? renderTemplate(msg.name, msg.params, msg.body)
        : msg.type === 'text'
          ? msg.body
          : msg.caption || MEDIA_LABEL[msg.type];
    const label = msg.type === 'template' ? body.slice(0, 40) : msg.type;
    if (!this.enabled) {
      this.logger.warn(`[WhatsApp] Not configured, skipping ${label}`);
      return {
        ok: false,
        error: 'WhatsApp no está configurado en el servidor',
      };
    }
    const phone = normalizePhone(to);
    if (!phone) {
      this.logger.warn(`[WhatsApp] Invalid phone "${to}"`);
      return { ok: false, error: 'Número inválido' };
    }

    let result: SendResult;
    try {
      result = this.viaZernio
        ? await this.sendZernio(phone, msg, label)
        : 'url' in msg
          ? { ok: false, error: 'Enviar fotos y videos requiere Zernio' }
          : await this.sendMeta(phone, msg, label);
    } catch (e) {
      this.logger.error(`[WhatsApp] ${label} failed:`, e);
      result = { ok: false, error: 'No se pudo conectar con WhatsApp' };
    }

    await this.logOutbound(
      phone,
      { type: msg.type, body, sentById, messageId },
      result,
    ).catch((e) =>
      this.logger.error('[WhatsApp] Could not log message in CRM:', e),
    );
    return result;
  }

  private async sendMeta(
    phone: string,
    msg: Exclude<Outbound, MediaOutbound>,
    label: string,
  ): Promise<SendResult> {
    const message =
      msg.type === 'template'
        ? {
            type: 'template',
            template: {
              name: msg.name,
              language: {
                code:
                  msg.language ?? process.env.WHATSAPP_TEMPLATE_LANG ?? 'es',
              },
              components: [
                {
                  type: 'body',
                  parameters: msg.params.map((p) => ({
                    type: 'text',
                    text: String(p),
                  })),
                },
              ],
            },
          }
        : { type: 'text', text: { body: msg.body, preview_url: true } };

    const version = process.env.WHATSAPP_API_VERSION ?? 'v21.0';
    const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        ...message,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => null)) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    } | null;
    if (res.ok) return { ok: true, waMessageId: data?.messages?.[0]?.id };
    this.logger.error(
      `[WhatsApp] ${label} → ${res.status}: ${JSON.stringify(data)}`,
    );
    return {
      ok: false,
      error: data?.error?.message
        ? `${data.error.message} (${data.error.code ?? res.status})`
        : `Meta respondió ${res.status}`,
    };
  }

  /** Photo and "about" the gyms see on the business number. Only through Zernio. */
  async getBusinessProfile(): Promise<{
    profilePictureUrl: string | null;
    about: string | null;
  }> {
    this.assertZernio();
    const params = new URLSearchParams({
      accountId: process.env.ZERNIO_WHATSAPP_ACCOUNT_ID!,
    });
    const res = await fetch(
      `${ZERNIO_API}/whatsapp/business-profile?${params}`,
      {
        headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = (await res.json().catch(() => null)) as
      | (ZernioError & {
          businessProfile?: { profilePictureUrl?: string; about?: string };
        })
      | null;
    if (!res.ok) throw this.zernioFailure('business-profile', res.status, data);
    return {
      profilePictureUrl: data?.businessProfile?.profilePictureUrl || null,
      about: data?.businessProfile?.about || null,
    };
  }

  /** JPEG/PNG up to 5 MB; Zernio runs Meta's resumable upload and applies it to the profile. */
  async setProfilePhoto(file: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
  }) {
    this.assertZernio();
    const form = new FormData();
    form.append('accountId', process.env.ZERNIO_WHATSAPP_ACCOUNT_ID!);
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname,
    );
    const res = await fetch(`${ZERNIO_API}/whatsapp/business-profile/photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => null)) as ZernioError | null;
    if (!res.ok) throw this.zernioFailure('profile photo', res.status, data);
  }

  private assertZernio() {
    if (!this.viaZernio) {
      throw new BadRequestException(
        'El perfil de WhatsApp solo se puede editar con Zernio configurado (ZERNIO_API_KEY y ZERNIO_WHATSAPP_ACCOUNT_ID)',
      );
    }
  }

  private zernioFailure(
    label: string,
    status: number,
    data: ZernioError | null,
  ) {
    this.logger.error(
      `[WhatsApp/Zernio] ${label} → ${status}: ${JSON.stringify(data)}`,
    );
    const reason = zernioReason(data);
    return new BadRequestException(
      reason ? `${reason} (${status})` : `Zernio respondió ${status}`,
    );
  }

  /**
   * Templates open (or reuse) the thread by phone number; free text can only go
   * into a thread Zernio already knows, i.e. one the contact or a template started.
   */
  private async sendZernio(
    phone: string,
    msg: Outbound,
    label: string,
  ): Promise<SendResult> {
    const accountId = process.env.ZERNIO_WHATSAPP_ACCOUNT_ID;
    let path: string;
    let payload: Record<string, unknown>;
    if (msg.type === 'template') {
      path = '/inbox/conversations';
      payload = {
        accountId,
        participantId: phone,
        templateName: msg.name,
        templateLanguage:
          msg.language ?? process.env.WHATSAPP_TEMPLATE_LANG ?? 'es',
        templateParams: msg.params.map(String),
      };
    } else {
      const conv = await this.prisma.waConversation.findUnique({
        where: { phone },
        select: { externalId: true },
      });
      if (!conv?.externalId) {
        return {
          ok: false,
          error:
            'Este chat todavía no existe en Zernio: enviá primero la plantilla de contacto.',
        };
      }
      path = `/inbox/conversations/${encodeURIComponent(conv.externalId)}/messages`;
      payload =
        msg.type === 'text'
          ? { accountId, message: msg.body }
          : {
              accountId,
              attachmentUrl: msg.url,
              attachmentType: msg.type,
              ...(msg.caption && { message: msg.caption }),
            };
    }

    const res = await fetch(`${ZERNIO_API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as
      | (ZernioError & {
          data?: { messageId?: string; conversationId?: string };
        })
      | null;
    if (res.ok) {
      return {
        ok: true,
        waMessageId: data?.data?.messageId,
        conversationId: data?.data?.conversationId,
      };
    }
    this.logger.error(
      `[WhatsApp/Zernio] ${label} → ${res.status}: ${JSON.stringify(data)}`,
    );
    const reason = zernioReason(data);
    return {
      ok: false,
      error: reason
        ? `${reason} (${res.status})`
        : `Zernio respondió ${res.status}`,
    };
  }

  private async logOutbound(
    phone: string,
    log: { type: string; body: string; sentById?: string; messageId?: string },
    result: SendResult,
  ) {
    const now = new Date();
    const existing = await this.prisma.waConversation.findUnique({
      where: { phone },
      select: { id: true, status: true, externalId: true },
    });
    const conversationId =
      existing?.id ??
      (
        await this.prisma.waConversation.create({
          data: {
            phone,
            // We wrote first: the ball is on the gym's side
            status: 'PENDING',
            gymId: (
              await this.prisma.gym.findFirst({
                where: { whatsappPhone: phone },
                select: { id: true },
              })
            )?.id,
          },
          select: { id: true },
        })
      ).id;

    const outcome = {
      waMessageId: result.waMessageId,
      status: result.ok ? 'sent' : 'failed',
      error: result.error ?? null,
    };
    if (log.messageId) {
      await this.prisma.waMessage.update({
        where: { id: log.messageId },
        data: outcome,
      });
    } else {
      await this.prisma.waMessage.create({
        data: {
          conversationId,
          direction: 'OUT',
          type: log.type,
          body: log.body,
          sentById: log.sentById,
          ...outcome,
        },
      });
    }
    await this.prisma.waConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        ...(result.conversationId &&
          !existing?.externalId && { externalId: result.conversationId }),
        // An admin reply means we're now waiting on the gym
        ...(log.sentById && result.ok && existing?.status !== 'CLOSED'
          ? { status: 'PENDING' }
          : {}),
      },
    });
  }
}

/** Meta wants the full international number, digits only (no +, spaces or dashes). */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  // No country code starts with 0: "0986660737" is a local number missing its +593
  if (digits.startsWith('0')) return null;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** Form input → stored value: empty clears it, anything unusable is a 400. */
export function parseWhatsapp(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const phone =
    typeof raw === 'string' || typeof raw === 'number'
      ? normalizePhone(String(raw))
      : null;
  if (!phone) {
    throw new BadRequestException(
      'Número de WhatsApp inválido: elegí el país e ingresá el número sin el 0 inicial, ej. +593 98 666 0737',
    );
  }
  return phone;
}
