import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletPassService } from '../wallet/wallet-pass.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passes: WalletPassService,
  ) {}

  async findAll(gymId: string, query: any) {
    const { memberId, membershipId, startDate, endDate, branchId } = query;
    const where: any = { gymId };
    if (memberId) where.memberId = memberId;
    if (membershipId) where.membershipId = membershipId;
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
    if (!gymId) throw new BadRequestException('gymId es requerido');
    const payload = { ...data, gymId };
    if (data.amount !== undefined)
      payload.amount = Math.round(Number(data.amount));
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
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return payment;
  }

  async remove(id: string, gymId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, gymId },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    await this.prisma.payment.delete({ where: { id } });

    if (payment.membershipId) {
      const remaining = await this.prisma.payment.count({
        where: { membershipId: payment.membershipId },
      });
      if (remaining === 0) {
        // Fully refunded: the membership never counted, so neither do the visits taken under it
        const removedAttendances = await this.prisma.$transaction(
          async (tx) => {
            const membership = await tx.membership.update({
              where: { id: payment.membershipId! },
              data: { status: 'CANCELLED' },
            });
            return this.deleteMembershipAttendances(tx, gymId, membership);
          },
        );
        void this.passes.sync(gymId, payment.memberId);
        return {
          message: 'Pago eliminado. Membresía cancelada por falta de pagos.',
          removedAttendances,
        };
      }
    }

    return { message: 'Pago eliminado.', removedAttendances: 0 };
  }

  /**
   * Deletes the check-ins that belong to a refunded membership: the ones that consumed
   * one of its visits, plus unlinked check-ins inside its period (unlimited plans don't
   * link attendance) unless another live membership of the member covers them.
   */
  private async deleteMembershipAttendances(
    tx: Prisma.TransactionClient,
    gymId: string,
    membership: {
      id: string;
      memberId: string;
      startDate: Date;
      endDate: Date;
    },
  ) {
    const [attendances, others] = await Promise.all([
      tx.attendance.findMany({
        where: {
          gymId,
          memberId: membership.memberId,
          OR: [
            { membershipId: membership.id },
            {
              membershipId: null,
              checkIn: { gte: membership.startDate, lte: membership.endDate },
            },
          ],
        },
        select: { id: true, checkIn: true, membershipId: true },
      }),
      tx.membership.findMany({
        where: {
          gymId,
          memberId: membership.memberId,
          id: { not: membership.id },
          status: { not: 'CANCELLED' },
        },
        select: { startDate: true, endDate: true },
      }),
    ]);

    const coveredElsewhere = (at: Date) =>
      others.some((o) => o.startDate <= at && at <= o.endDate);
    const ids = attendances
      .filter(
        (a) => a.membershipId === membership.id || !coveredElsewhere(a.checkIn),
      )
      .map((a) => a.id);
    if (ids.length === 0) return 0;

    const { count } = await tx.attendance.deleteMany({
      where: { id: { in: ids } },
    });
    return count;
  }
}
