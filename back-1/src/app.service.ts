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

  async getPublicSubscriptionPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map((plan) => {
      const active = plan.discountActive && (plan.discountPercent ?? 0) > 0;
      const finalPrice = active
        ? Math.round(plan.price * (1 - (plan.discountPercent ?? 0) / 100))
        : plan.price;
      const yearly = plan.yearlyPrice != null ? (() => {
        const yFinal = active
          ? Math.round(plan.yearlyPrice! * (1 - (plan.discountPercent ?? 0) / 100))
          : plan.yearlyPrice!;
        return { yearlyFinalPrice: yFinal, yearlySaving: plan.yearlyPrice! - yFinal, yearlyMonthlyEquivalent: Math.round(yFinal / 12) };
      })() : { yearlyFinalPrice: null, yearlySaving: null, yearlyMonthlyEquivalent: null };

      return { ...plan, finalPrice, discountSaving: plan.price - finalPrice, ...yearly };
    });
  }
}
