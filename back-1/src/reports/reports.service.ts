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

  async advanced(gymId: string, query: any) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { currency: true, timezone: true, country: true },
    });

    const tz = gym?.timezone ?? getTimezone(gym?.country);
    const now = new Date();
    const startDate = query.startDate ? new Date(query.startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = query.endDate ? new Date(query.endDate) : now;

    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [membershipsSold, storeSales, storeCredits, activeMemberships, newMembers, churned, expiringNext7Days, attendancesSample, attendancesWeek] =
      await Promise.all([
        this.prisma.membership.findMany({
          where: { gymId, createdAt: { gte: startDate, lte: endDate } },
          select: { createdAt: true, plan: { select: { price: true } } },
        }),
        this.prisma.productSale.findMany({
          where: { gymId, createdAt: { gte: startDate, lte: endDate } },
          select: { total: true, createdAt: true, method: true },
        }),
        this.prisma.memberProductCredit.findMany({
          where: { gymId, isPaid: false, createdAt: { gte: startDate, lte: endDate } },
          select: { quantity: true, unitPrice: true, createdAt: true },
        }),
        this.prisma.membership.findMany({
          where: { gymId, status: 'ACTIVE' },
          include: { plan: { select: { name: true, price: true } } },
        }),
        this.prisma.member.count({ where: { gymId, createdAt: { gte: startDate, lte: endDate } } }),
        this.prisma.membership.count({
          where: { gymId, status: { in: ['EXPIRED', 'CANCELLED'] }, updatedAt: { gte: startDate, lte: endDate } },
        }),
        this.prisma.membership.count({
          where: { gymId, status: 'ACTIVE', endDate: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } },
        }),
        this.prisma.attendance.findMany({
          where: { gymId, checkIn: { gte: ninetyDaysAgo } },
          select: { checkIn: true },
        }),
        this.prisma.attendance.findMany({
          where: { gymId, checkIn: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
          select: { checkIn: true, groupId: true, group: { select: { name: true } } },
        }),
      ]);

    // revenueTrend — memberships sold in period, using plan price as revenue amount
    const rangeDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const membershipPayments = membershipsSold.map(m => ({ amount: Number(m.plan.price), createdAt: m.createdAt }));
    const revenueTrend = buildRevenueTrend(membershipPayments, startDate, endDate, rangeDays, query.granularity);

    // store trends
    const storeSalesPayments = storeSales.map(s => ({ amount: s.total, createdAt: s.createdAt }));
    const storeSalesTrend = buildRevenueTrend(storeSalesPayments, startDate, endDate, rangeDays, query.granularity);
    const storeCreditPayments = storeCredits.map(c => ({ amount: c.quantity * c.unitPrice, createdAt: c.createdAt }));
    const storeCreditTrend = buildRevenueTrend(storeCreditPayments, startDate, endDate, rangeDays, query.granularity);
    const storeRevenue = storeSales.reduce((s, p) => s + p.total, 0);
    const storeCreditIssued = storeCredits.reduce((s, c) => s + c.quantity * c.unitPrice, 0);

    // membersByPlan
    const totalActive = activeMemberships.length;
    const byPlanMap = new Map<string, { count: number; price: number }>();
    for (const m of activeMemberships) {
      const cur = byPlanMap.get(m.plan.name) ?? { count: 0, price: Number(m.plan.price) };
      byPlanMap.set(m.plan.name, { count: cur.count + 1, price: cur.price });
    }
    const membersByPlan = Array.from(byPlanMap.entries()).map(([planName, { count, price }]) => ({
      planName,
      count,
      price, // in cents — MoneyTransformInterceptor divides by 100 on response
      percent: totalActive > 0 ? Math.round((count / totalActive) * 100) : 0,
    }));

    // attendanceTrend — last 7 days
    const attendanceTrend = buildAttendanceTrend(attendancesWeek, now);
    const attendanceTrendByGroup = buildAttendanceTrendByGroup(attendancesWeek, now);

    // peakDay / peakHour — computed in JS from 90-day sample
    const dowCount = new Array(7).fill(0) as number[];
    const hourCount = new Array(24).fill(0) as number[];
    for (const a of attendancesSample) {
      dowCount[a.checkIn.getUTCDay()]++;
      hourCount[a.checkIn.getUTCHours()]++;
    }
    const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const peakDay = attendancesSample.length > 0 ? DAYS_ES[dowCount.indexOf(Math.max(...dowCount))] : null;
    const peakHour = attendancesSample.length > 0
      ? `${String(hourCount.indexOf(Math.max(...hourCount))).padStart(2, '0')}:00`
      : null;

    return {
      revenueTrend,
      storeSalesTrend,
      storeCreditTrend,
      storeRevenue,
      storeCreditIssued,
      membersByPlan,
      attendanceTrend,
      attendanceTrendByGroup,
      newMembers,
      churned,
      expiringNext7Days,
      peakDay,
      peakHour,
      currency: gym?.currency ?? 'USD',
    };
  }
}

function buildRevenueTrend(
  payments: { amount: number; createdAt: Date }[],
  startDate: Date,
  endDate: Date,
  rangeDays: number,
  granularity?: string,
): { label: string; amount: number }[] {
  const byDay = granularity === 'daily' || rangeDays <= 14;
  const buckets = new Map<string, number>();

  if (byDay) {
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const label = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      buckets.set(label, 0);
    }
  }

  for (const p of payments) {
    let label: string;
    if (byDay) {
      const d = p.createdAt;
      label = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    } else {
      const weekNum = Math.floor((p.createdAt.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      label = `S${weekNum}`;
    }
    if (byDay && !buckets.has(label)) continue;
    buckets.set(label, (buckets.get(label) ?? 0) + Number(p.amount));
  }

  return Array.from(buckets.entries()).map(([label, amount]) => ({ label, amount }));
}

function buildAttendanceTrendByGroup(
  attendances: { checkIn: Date; groupId: string | null; group: { name: string } | null }[],
  now: Date,
): { groupId: string | null; groupName: string | null; trend: { label: string; count: number }[] }[] {
  const DAYS_ES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dayLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dayLabels.push(DAYS_ES_SHORT[d.getUTCDay()]);
  }

  const groupMap = new Map<string | null, { name: string | null; items: { checkIn: Date }[] }>();
  for (const a of attendances) {
    const key = a.groupId;
    if (!groupMap.has(key)) groupMap.set(key, { name: a.group?.name ?? null, items: [] });
    groupMap.get(key)!.items.push({ checkIn: a.checkIn });
  }

  const result: { groupId: string | null; groupName: string | null; trend: { label: string; count: number }[] }[] = [];
  for (const [gid, { name, items }] of groupMap) {
    const buckets = new Map<string, number>(dayLabels.map(l => [l, 0]));
    for (const a of items) {
      const label = DAYS_ES_SHORT[a.checkIn.getUTCDay()];
      if (buckets.has(label)) buckets.set(label, (buckets.get(label) ?? 0) + 1);
    }
    result.push({ groupId: gid, groupName: name, trend: dayLabels.map(l => ({ label: l, count: buckets.get(l) ?? 0 })) });
  }

  // Named groups first, ungrouped last; only keep groups with at least one check-in
  return result
    .filter(g => g.trend.some(t => t.count > 0))
    .sort((a, b) => {
      if (a.groupId === null) return 1;
      if (b.groupId === null) return -1;
      return (a.groupName ?? '').localeCompare(b.groupName ?? '');
    });
}

function buildAttendanceTrend(
  attendances: { checkIn: Date }[],
  now: Date,
): { label: string; count: number }[] {
  const DAYS_ES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const buckets = new Map<string, number>();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    buckets.set(DAYS_ES_SHORT[d.getUTCDay()], 0);
  }

  for (const a of attendances) {
    const label = DAYS_ES_SHORT[a.checkIn.getUTCDay()];
    if (buckets.has(label)) buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([label, count]) => ({ label, count }));
}
