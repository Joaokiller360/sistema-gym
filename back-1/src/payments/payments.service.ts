import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { centsToDecimal } from '../common/utils/proration.util';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(gymId: string, query: any) {
    const { memberId, startDate, endDate, branchId } = query;
    const where: any = { gymId };
    if (memberId) where.memberId = memberId;
    if (branchId) where.branchId = branchId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    return this.prisma.payment.findMany({
      where,
      include: { member: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(gymId: string, data: any) {
    const payload = { ...data, gymId };
    if (data.amount !== undefined) payload.amount = centsToDecimal(data.amount);
    return this.prisma.payment.create({ data: payload });
  }

  async getReceipt(id: string, gymId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, gymId },
      include: {
        member: true,
        membership: { include: { plan: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async remove(id: string, gymId: string | undefined) {
    const where: any = { id };
    if (gymId) where.gymId = gymId;
    const payment = await this.prisma.payment.findFirst({ where });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    await this.prisma.payment.delete({ where: { id } });

    if (payment.membershipId) {
      const remaining = await this.prisma.payment.count({ where: { membershipId: payment.membershipId } });
      if (remaining === 0) {
        await this.prisma.membership.update({
          where: { id: payment.membershipId },
          data: { status: 'CANCELLED' },
        });
        return { message: 'Pago eliminado. Membresía cancelada por falta de pagos.' };
      }
    }

    return { message: 'Pago eliminado.' };
  }
}
