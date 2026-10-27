import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { PlanLimitAlertsService } from './plan-limit-alerts.service';

@Module({
  providers: [WhatsappService, PlanLimitAlertsService],
  exports: [WhatsappService, PlanLimitAlertsService],
})
export class NotificationsModule {}
