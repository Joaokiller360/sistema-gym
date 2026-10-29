import {
  Controller,
  ForbiddenException,
  HttpCode,
  Logger,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { CrmService, type ZernioWebhookPayload } from './crm.service';

/** Public endpoint Zernio calls (Zernio → Webhooks, events message.received/sent/delivered/read/failed). */
@SkipThrottle()
@Controller('zernio/webhook')
export class ZernioWebhookController {
  private readonly logger = new Logger(ZernioWebhookController.name);

  constructor(private readonly crm: CrmService) {}

  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>) {
    // Without the secret anyone could inject fake messages into the CRM
    if (!this.validSignature(req)) {
      this.logger.warn(
        '[Zernio] Rejected payload with missing/invalid signature',
      );
      throw new ForbiddenException();
    }
    // Zernio retries anything that isn't a 2xx: a bad event must not loop forever
    await this.crm
      .handleZernioWebhook(req.body as ZernioWebhookPayload)
      .catch((e) => this.logger.error('[Zernio] Webhook handling failed:', e));
    return { ok: true };
  }

  private validSignature(req: RawBodyRequest<Request>) {
    const secret = process.env.ZERNIO_WEBHOOK_SECRET;
    const header = req.headers['x-zernio-signature'];
    if (!secret || typeof header !== 'string' || !req.rawBody) return false;
    // Lowercase hex HMAC-SHA256 of the raw body, no prefix
    const expected = createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('hex');
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
