import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
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
