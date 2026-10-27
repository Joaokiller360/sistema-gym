import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { renderTemplate } from './whatsapp-templates';

/** Positional body parameters, in the order the template declares {{1}}, {{2}}, … */
export type TemplateParams = Array<string | number>;

export interface SendResult {
  ok: boolean;
  waMessageId?: string;
  error?: string;
}

/**
 * WhatsApp Cloud API (Meta) sender. Business-initiated messages must use an
 * approved template; see docs/whatsapp-templates.md for the ones this app expects.
 * Every sent message is also logged in the CRM conversation for that number.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly prisma: PrismaService) {}

  get enabled() {
    return (
      !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID
    );
  }

  /** Returns true when Meta accepted the message. Never throws. */
  async sendTemplate(
    to: string,
    template: string,
    params: TemplateParams,
    sentById?: string,
  ): Promise<boolean> {
    const res = await this.send(
      to,
      {
        type: 'template',
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? 'es' },
          components: [
            {
              type: 'body',
              parameters: params.map((p) => ({
                type: 'text',
                text: String(p),
              })),
            },
          ],
        },
      },
      { type: 'template', body: renderTemplate(template, params), sentById },
    );
    return res.ok;
  }

  /** Free-form text; Meta only delivers it within 24 h of the contact's last message. */
  sendText(to: string, body: string, sentById?: string): Promise<SendResult> {
    return this.send(
      to,
      { type: 'text', text: { body, preview_url: true } },
      { type: 'text', body, sentById },
    );
  }

  private async send(
    to: string,
    message: Record<string, unknown>,
    log: { type: string; body: string; sentById?: string },
  ): Promise<SendResult> {
    const label = log.type === 'template' ? log.body.slice(0, 40) : 'text';
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

    const version = process.env.WHATSAPP_API_VERSION ?? 'v21.0';
    const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    let result: SendResult;
    try {
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
      if (res.ok) {
        result = { ok: true, waMessageId: data?.messages?.[0]?.id };
      } else {
        this.logger.error(
          `[WhatsApp] ${label} → ${res.status}: ${JSON.stringify(data)}`,
        );
        result = {
          ok: false,
          error: data?.error?.message
            ? `${data.error.message} (${data.error.code ?? res.status})`
            : `Meta respondió ${res.status}`,
        };
      }
    } catch (e) {
      this.logger.error(`[WhatsApp] ${label} failed:`, e);
      result = { ok: false, error: 'No se pudo conectar con WhatsApp' };
    }

    await this.logOutbound(phone, log, result).catch((e) =>
      this.logger.error('[WhatsApp] Could not log message in CRM:', e),
    );
    return result;
  }

  private async logOutbound(
    phone: string,
    log: { type: string; body: string; sentById?: string },
    result: SendResult,
  ) {
    const now = new Date();
    const existing = await this.prisma.waConversation.findUnique({
      where: { phone },
      select: { id: true, status: true },
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

    await this.prisma.waMessage.create({
      data: {
        conversationId,
        direction: 'OUT',
        type: log.type,
        body: log.body,
        sentById: log.sentById,
        waMessageId: result.waMessageId,
        status: result.ok ? 'sent' : 'failed',
        error: result.error,
      },
    });
    await this.prisma.waConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
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
      'Número de WhatsApp inválido: usá el formato internacional, ej. +5491122334455',
    );
  }
  return phone;
}
