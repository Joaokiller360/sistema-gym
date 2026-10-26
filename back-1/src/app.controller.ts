import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Public liveness + DB check, polled by the super-admin dashboard
  @SkipThrottle()
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('platform-settings')
  getPlatformSettings() {
    return this.appService.getPlatformSettings();
  }

  @Get('subscription-plans')
  getSubscriptionPlans() {
    return this.appService.getPublicSubscriptionPlans();
  }
}
