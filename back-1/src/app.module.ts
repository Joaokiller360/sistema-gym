import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { GymsModule } from './gyms/gyms.module';
import { PlansModule } from './plans/plans.module';
import { MembersModule } from './members/members.module';
import { MembershipsModule } from './memberships/memberships.module';
import { PaymentsModule } from './payments/payments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { TrainersModule } from './trainers/trainers.module';
import { ClassesModule } from './classes/classes.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReportsModule } from './reports/reports.module';
import { CommunicationsModule } from './communications/communications.module';
import { MarketingModule } from './marketing/marketing.module';
import { BranchesModule } from './branches/branches.module';
import { StoreModule } from './store/store.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    SuperAdminModule,
    GymsModule,
    PlansModule,
    MembersModule,
    MembershipsModule,
    PaymentsModule,
    AttendanceModule,
    TrainersModule,
    ClassesModule,
    InventoryModule,
    ReportsModule,
    CommunicationsModule,
    MarketingModule,
    BranchesModule,
    StoreModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
