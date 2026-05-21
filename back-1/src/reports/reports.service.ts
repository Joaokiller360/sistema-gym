import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildDateRangeFilter, getTimezone } from '../common/utils/timezone.util';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getGym(gymId: string) {
    return this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { currency: true, timezone: true, country: true },
    });
  }

  async financial(gymId: string, query: any) {
    const gym = await this.getGym(gymId);
    const tz = gym?.timezone ?? getTimezone(gym?.country);
    const createdAt = buildDateRangeFilter(query.startDate, query.endDate, tz);

    const where: any = { gymId };
    if (createdAt) where.createdAt = createdAt;
    if (query.branchId) where.branchId = query.branchId;

    const byMethod = await this.prisma.payment.groupBy({
      by: ['method'],
      where,
      _sum: { amount: true },
      _count: true,
    });

    const totalRevenue = byMethod.reduce((acc, p) => acc + Number(p._sum.amount ?? 0), 0);

    return {
      totalRevenue,
      currency: gym?.currency ?? 'USD',
      timezone: tz,
      byMethod: byMethod.map(p => ({
        method: p.method,
        count: p._count,
        total: Number(p._sum.amount ?? 0),
      })),
    };
  }

  async retention(gymId: string, query: any) {
    const where: any = { gymId };
    if (query.branchId) where.branchId = query.branchId;

    const [total, active, expired, cancelled, suspended] = await Promise.all([
      this.prisma.membership.count({ where }),
      this.prisma.membership.count({ where: { ...where, status: 'ACTIVE' } }),
      this.prisma.membership.count({ where: { ...where, status: 'EXPIRED' } }),
      this.prisma.membership.count({ where: { ...where, status: 'CANCELLED' } }),
      this.prisma.membership.count({ where: { ...where, status: 'SUSPENDED' } }),
    ]);

    return {
      total,
      activeCount: active,
      expiredCount: expired,
      cancelledCount: cancelled,
      suspendedCount: suspended,
      retentionRate: total > 0 ? ((active / total) * 100).toFixed(2) : '0',
    };
  }

  async attendance(gymId: string, query: any) {
    const gym = await this.getGym(gymId);
    const tz = gym?.timezone ?? getTimezone(gym?.country);
    const checkIn = buildDateRangeFilter(query.startDate, query.endDate, tz);

    const where: any = { gymId };
    if (checkIn) where.checkIn = checkIn;
    if (query.branchId) where.branchId = query.branchId;

    const [total, withCheckout] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.count({ where: { ...where, checkOut: { not: null } } }),
    ]);

    return {
      totalVisits: total,
      totalCheckins: total,
      completed: withCheckout,
      inProgress: total - withCheckout,
      timezone: tz,
    };
  }

  async classes(gymId: string, query: any) {
    const where: any = { gymId };
    if (query.branchId) where.branchId = query.branchId;

    return this.prisma.class.findMany({
      where,
      include: {
        _count: { select: { enrollments: true } },
        trainer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
