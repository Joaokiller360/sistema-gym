import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { calculateProration } from '../common/utils/proration.util';

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string, query: any) {
    const { status, memberId, planId, branchId } = query;
    const where: any = { gymId };
    if (status) where.status = status;
    if (memberId) where.memberId = memberId;
    if (planId) where.planId = planId;
    if (branchId) where.branchId = branchId;

    return this.prisma.membership.findMany({
      where,
      include: { member: true, plan: true, branch: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(gymId: string, data: any) {
    return this.prisma.membership.create({
      data: { ...data, gymId },
      include: { member: true, plan: true },
    });
  }

  async changePlan(membershipId: string, gymId: string | undefined, data: {
    planId: string;
    method?: string;
    notes?: string;
  }) {
    const where: any = { id: membershipId, status: 'ACTIVE' };
    if (gymId) where.gymId = gymId;

    const current = await this.prisma.membership.findFirst({
      where,
      include: { plan: true },
    });
    if (!current) throw new NotFoundException('Membresía activa no encontrada');
    if (current.planId === data.planId) throw new BadRequestException('El miembro ya tiene ese plan');

    const newPlan = await this.prisma.plan.findFirst({
      where: gymId ? { id: data.planId, gymId } : { id: data.planId },
    });
    if (!newPlan) throw new NotFoundException('Plan destino no encontrado');

    const now = new Date();
    const proration = calculateProration({
      oldPlanPrice: Number(current.plan.price),
      oldPlanDurationDays: current.plan.durationDays,
      periodStart: current.startDate,
      newPlanPrice: Number(newPlan.price),
      changeDate: now,
    });

    const newEndDate = new Date(now.getTime() + newPlan.durationDays * 24 * 60 * 60 * 1000);
    const resolvedGymId = current.gymId;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: membershipId },
        data: {
          status: 'CANCELLED',
          endDate: now,
          notes: `Cancelado por cambio a plan "${newPlan.name}"`,
        },
      });

      const newMembership = await tx.membership.create({
        data: {
          gymId: resolvedGymId,
          memberId: current.memberId,
          planId: data.planId,
          branchId: current.branchId ?? undefined,
          startDate: now,
          endDate: newEndDate,
          status: 'ACTIVE',
          notes: data.notes ?? `Cambio desde "${current.plan.name}". Crédito aplicado: $${proration.creditApplied}`,
        },
        include: { plan: true, member: true },
      });

      const payment = await tx.payment.create({
        data: {
          gymId: resolvedGymId,
          memberId: current.memberId,
          membershipId: newMembership.id,
          amount: proration.amountDue,
          currency: newPlan.currency,
          method: (data.method as any) ?? 'CASH',
          notes: [
            `Cambio de plan: "${current.plan.name}" → "${newPlan.name}"`,
            `Días consumidos: ${proration.daysConsumed} / ${current.plan.durationDays}`,
            `Días restantes: ${proration.daysRemaining}`,
            `Crédito aplicado: $${proration.creditApplied}`,
            `Total cobrado: $${proration.amountDue}`,
          ].join(' | '),
        },
      });

      return { newMembership, payment };
    });

    return {
      proration,
      membership: result.newMembership,
      payment: result.payment,
      previousMembershipId: membershipId,
    };
  }

  async suspend(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.prisma.membership.update({ where: { id }, data: { status: 'SUSPENDED' } });
  }

  async freeze(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.prisma.membership.update({
      where: { id },
      data: { status: 'FROZEN', frozenAt: new Date() },
    });
  }

  async unfreeze(id: string, gymId: string) {
    const m = await this.assertExists(id, gymId);
    const frozenDays = m.frozenAt
      ? Math.ceil((Date.now() - m.frozenAt.getTime()) / 86_400_000)
      : 0;
    const newEndDate = new Date(m.endDate);
    newEndDate.setDate(newEndDate.getDate() + frozenDays);

    return this.prisma.membership.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        frozenAt: null,
        frozenDays: { increment: frozenDays },
        endDate: newEndDate,
      },
    });
  }

  async cancel(id: string, gymId: string) {
    console.log('[MembershipsService.cancel] id:', id, 'gymId:', gymId);
    const m = await this.prisma.membership.findFirst({ where: { id, gymId } });
    console.log('[MembershipsService.cancel] found:', JSON.stringify(m));
    if (!m) throw new NotFoundException('Membership not found');
    return this.prisma.membership.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  private async assertExists(id: string, gymId: string) {
    const m = await this.prisma.membership.findFirst({ where: { id, gymId } });
    if (!m) throw new NotFoundException('Membership not found');
    return m;
  }
}
