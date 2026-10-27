import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [CrmController, WhatsappWebhookController],
  providers: [CrmService],
})
export class CrmModule {}
