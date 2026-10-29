import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SuperAdminModule } from '../super-admin/super-admin.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { ZernioWebhookController } from './zernio-webhook.controller';

@Module({
  imports: [NotificationsModule, SuperAdminModule],
  controllers: [
    CrmController,
    WhatsappWebhookController,
    ZernioWebhookController,
  ],
  providers: [CrmService],
})
export class CrmModule {}
