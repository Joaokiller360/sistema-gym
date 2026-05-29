import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class ThrottlerLoggingGuard extends ThrottlerGuard {
  private readonly logger = new Logger('RateLimit');

  protected async throwThrottlingException(
    context: ExecutionContext,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest();
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      'unknown';
    const user = req.user?.userId ?? req.user?.email ?? 'unauthenticated';
    const endpoint = `${req.method} ${req.url}`;

    this.logger.warn(`429 RATE LIMIT | ip=${ip} | user=${user} | endpoint=${endpoint}`);

    throw new ThrottlerException();
  }
}
