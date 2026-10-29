import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SuperAdminModule } from '../super-admin/super-admin.module';
import { CrmCatalogController } from './crm-catalog.controller';
import { CrmCatalogService } from './crm-catalog.service';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { ZernioWebhookController } from './zernio-webhook.controller';

@Module({
  imports: [NotificationsModule, SuperAdminModule],
  controllers: [
    CrmController,
    CrmCatalogController,
    WhatsappWebhookController,
    ZernioWebhookController,
  ],
  providers: [CrmService, CrmCatalogService],
})
export class CrmModule {}
