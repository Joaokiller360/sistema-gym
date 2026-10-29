import { Module } from '@nestjs/common';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';

@Module({
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
  // The CRM creates gym accounts from a chat
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
