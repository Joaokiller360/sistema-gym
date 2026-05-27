import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function applyDiscount(plan: any) {
  const active = plan.discountActive && plan.discountPercent > 0;
  const finalPrice = active
    ? Math.round(plan.price * (1 - plan.discountPercent / 100))
    : plan.price;
  const discountSaving = plan.price - finalPrice;

  const yearly: Record<string, number | null> = {
    yearlyFinalPrice: null,
    yearlySaving: null,
    yearlyMonthlyEquivalent: null,
  };
  if (plan.yearlyPrice != null) {
    const yFinal = active
      ? Math.round(plan.yearlyPrice * (1 - plan.discountPercent / 100))
      : plan.yearlyPrice;
    yearly.yearlyFinalPrice = yFinal;
    yearly.yearlySaving = plan.yearlyPrice - yFinal;
    yearly.yearlyMonthlyEquivalent = Math.round(yFinal / 12);
  }

  return { ...plan, finalPrice, discountSaving, ...yearly };
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string) {
    const plans = await this.prisma.plan.findMany({
      where: { gymId },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });
    return plans.map(applyDiscount);
  }

  async findOne(id: string, gymId: string) {
    const plan = await this.assertExists(id, gymId);
    return applyDiscount(plan);
  }

  async create(gymId: string, data: any) {
    if (!gymId) throw new BadRequestException('gymId es requerido');
    const payload = { ...data, gymId };
    if (data.price !== undefined) payload.price = Math.round(Number(data.price));
    if (data.yearlyPrice !== undefined) payload.yearlyPrice = Math.round(Number(data.yearlyPrice));
    const plan = await this.prisma.plan.create({ data: payload });
    return applyDiscount(plan);
  }

  async update(id: string, gymId: string, data: any) {
    await this.assertExists(id, gymId);
    const payload = { ...data };
    if (data.price !== undefined) payload.price = Math.round(Number(data.price));
    if (data.yearlyPrice !== undefined) payload.yearlyPrice = Math.round(Number(data.yearlyPrice));
    const plan = await this.prisma.plan.update({ where: { id }, data: payload });
    return applyDiscount(plan);
  }

  async toggle(id: string, gymId: string) {
    const plan = await this.assertExists(id, gymId);
    const updated = await this.prisma.plan.update({
      where: { id },
      data: { isActive: !plan.isActive },
    });
    return applyDiscount(updated);
  }

  async setDiscount(id: string, gymId: string, discountPercent: number, yearlyPrice?: number) {
    await this.assertExists(id, gymId);
    const plan = await this.prisma.plan.update({
      where: { id },
      data: {
        discountPercent,
        ...(yearlyPrice !== undefined ? { yearlyPrice: Math.round(Number(yearlyPrice)) } : {}),
      },
    });
    return applyDiscount(plan);
  }

  async toggleDiscount(id: string, gymId: string) {
    const plan = await this.assertExists(id, gymId);
    if (!plan.discountPercent || plan.discountPercent === 0) {
      throw new BadRequestException('Configura un descuento (discountPercent) antes de activarlo');
    }
    const updated = await this.prisma.plan.update({
      where: { id },
      data: { discountActive: !plan.discountActive },
    });
    return applyDiscount(updated);
  }

  async remove(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.prisma.plan.delete({ where: { id } });
  }

  private async assertExists(id: string, gymId?: string) {
    const plan = await this.prisma.plan.findFirst({
      where: gymId ? { id, gymId } : { id },
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return plan;
  }
}
