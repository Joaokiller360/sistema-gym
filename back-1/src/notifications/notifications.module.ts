import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { PlanLimitAlertsService } from './plan-limit-alerts.service';
import { MessageQuotaService } from './message-quota.service';
import { MessagePacksService } from './message-packs.service';

@Module({
  providers: [WhatsappService, PlanLimitAlertsService, MessageQuotaService, MessagePacksService],
  exports: [WhatsappService, PlanLimitAlertsService, MessageQuotaService, MessagePacksService],
})
export class NotificationsModule {}
