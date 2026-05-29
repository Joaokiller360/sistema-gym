import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AdvancedReportsGuard } from './guards/advanced-reports.guard';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, AdvancedReportsGuard],
})
export class ReportsModule {}
