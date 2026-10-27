import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { CrmService, type WebhookPayload } from './crm.service';

/** Public endpoint Meta calls (configure it in the app's WhatsApp → Configuration → Webhook). */
@SkipThrottle()
@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private readonly crm: CrmService) {}

  // Meta's one-time verification handshake
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode !== 'subscribe' || !expected || token !== expected) {
      throw new ForbiddenException();
    }
    return challenge;
  }

  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>) {
    // Without the app secret anyone could inject fake messages into the CRM
    if (!this.validSignature(req)) {
      this.logger.warn(
        '[Webhook] Rejected payload with missing/invalid signature',
      );
      throw new ForbiddenException();
    }
    await this.crm.handleWebhook(req.body as WebhookPayload);
    return { ok: true };
  }

  private validSignature(req: RawBodyRequest<Request>) {
    const secret = process.env.WHATSAPP_APP_SECRET;
    const header = req.headers['x-hub-signature-256'];
    if (!secret || typeof header !== 'string' || !req.rawBody) return false;
    const expected = `sha256=${createHmac('sha256', secret).update(req.rawBody).digest('hex')}`;
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
