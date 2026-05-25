import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return '!';
  }

  getPlatformSettings() {
    return this.prisma.platformSettings.upsert({
      where: { id: '1' },
      create: { id: '1' },
      update: {},
    });
  }

  getPublicSubscriptionPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }
}
