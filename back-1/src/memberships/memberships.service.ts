import { randomUUID } from 'crypto';
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { calculateProration } from '../common/utils/proration.util';
import { startOfDayUTC, endOfDayUTC } from '../common/utils/timezone.util';
import { getPlanFlagsByKey } from '../common/utils/subscription-plan.util';
import { WalletPassService } from '../wallet/wallet-pass.service';
import { WhatsappService } from '../notifications/whatsapp.service';
import { MessageQuotaService } from '../notifications/message-quota.service';
import { TEMPLATES } from '../notifications/whatsapp-templates';
import { mapLimit, memberWhatsapp } from '../notifications/member-phone.util';

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passes: WalletPassService,
    private readonly whatsapp: WhatsappService,
    private readonly quota: MessageQuotaService,
  ) {}

  /** Refresh the member's Wallet pass after a membership change (best-effort, not awaited). */
  private syncPass<T extends { memberId: string; gymId: string }>(m: T): T {
    void this.passes.sync(m.gymId, m.memberId);
    return m;
  }

  async findAll(gymId: string, query: any) {
    const { status, memberId, planId, branchId, endsAfter, endsBefore } = query;
    const where: any = { gymId };
    if (status) where.status = status;
    if (memberId) where.memberId = memberId;
    if (planId) where.planId = planId;
    if (branchId) where.branchId = branchId;
    if (endsAfter || endsBefore) {
      let tz = 'UTC';
      if (gymId) {
        const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: { timezone: true } });
        tz = gym?.timezone ?? 'UTC';
      }

      const gteDate = endsAfter ? startOfDayUTC(endsAfter, tz) : undefined;
      const lteDate = endsBefore ? endOfDayUTC(endsBefore, tz) : undefined;

      where.endDate = {};
      if (gteDate) where.endDate.gte = gteDate;
      if (lteDate) where.endDate.lte = lteDate;

      // --- TEMP DEBUG LOGS (remove after fixing expiry alert) ---
      const now = new Date();
      const nowInGymTimezone = now.toLocaleString('es', { timeZone: tz });
      this.logger.debug(`[ExpiryAlert] gymTz=${tz} endsAfter=${endsAfter}→${gteDate?.toISOString()} endsBefore=${endsBefore}→${lteDate?.toISOString()}`);
      const allActiveForLog = await this.prisma.membership.findMany({
        where: { gymId, status: 'ACTIVE' },
        include: { member: { select: { firstName: true, lastName: true } } },
      });
      for (const m of allActiveForLog) {
        const daysRemaining = Math.ceil((m.endDate.getTime() - now.getTime()) / 86400000);
        const passesGte = gteDate ? m.endDate >= gteDate : true;
        const passesLte = lteDate ? m.endDate <= lteDate : true;
        const includedInExpiringAlert = passesGte && passesLte;
        this.logger.debug(
          `[ExpiryAlert] memberName="${m.member.firstName} ${m.member.lastName}" ` +
          `endsAt=${m.endDate.toISOString()} ` +
          `nowInGymTimezone="${nowInGymTimezone}" ` +
          `daysRemaining=${daysRemaining} ` +
          `includedInExpiringAlert=${includedInExpiringAlert}`,
        );
      }
      // --- END TEMP DEBUG LOGS ---
    }

    const memberships = await this.prisma.membership.findMany({
      where,
      include: { member: true, plan: true, branch: true },
      orderBy: { createdAt: 'desc' },
    });
    return this.withGroups(memberships);
  }

  /** Attach the other people sharing each membership's plan purchase. */
  private async withGroups<T extends { id: string; groupId: string | null }>(memberships: T[]) {
    const groupIds = [...new Set(memberships.map(m => m.groupId).filter((g): g is string => !!g))];
    if (groupIds.length === 0) return memberships.map(m => ({ ...m, group: [] }));
    const mates = await this.prisma.membership.findMany({
      where: { groupId: { in: groupIds } },
      select: {
        id: true, groupId: true, status: true, memberId: true,
        member: { select: { firstName: true, lastName: true } },
      },
    });
    return memberships.map(m => ({
      ...m,
      group: m.groupId ? mates.filter(x => x.groupId === m.groupId && x.id !== m.id) : [],
    }));
  }

  /** Companions must belong to the gym, be distinct and not hold another active plan. */
  private async assertCompanions(gymId: string, holderId: string, ids: string[]) {
    if (new Set(ids).size !== ids.length || ids.includes(holderId)) {
      throw new BadRequestException('Los acompañantes deben ser personas distintas al titular');
    }
    const members = await this.prisma.member.findMany({
      where: { id: { in: ids }, gymId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (members.length !== ids.length) throw new NotFoundException('Acompañante no encontrado');
    const busy = await this.prisma.membership.findFirst({
      where: { gymId, memberId: { in: ids }, status: 'ACTIVE' },
      include: { member: { select: { firstName: true, lastName: true } } },
    });
    if (busy) {
      throw new BadRequestException(`${busy.member.firstName} ${busy.member.lastName} ya tiene un plan activo`);
    }
  }

  async create(gymId: string, data: any) {
    const plan = await this.prisma.plan.findFirst({
      where: { id: data.planId, gymId },
      select: { visitLimit: true, maxMembers: true },
    });
    if (!plan) throw new NotFoundException('Plan no encontrado');

    const { periods = 1, companionIds = [], ...rest } = data;
    if (companionIds.length > plan.maxMembers - 1) {
      throw new BadRequestException(
        plan.maxMembers === 1
          ? 'Este plan es individual'
          : `Este plan cubre hasta ${plan.maxMembers} personas`,
      );
    }
    if (companionIds.length) await this.assertCompanions(gymId, data.memberId, companionIds);

    const shared = {
      ...rest,
      gymId,
      groupId: plan.maxMembers > 1 ? randomUUID() : null,
      visitsTotal: plan.visitLimit != null ? plan.visitLimit * periods : null,
      visitsUsed: 0,
    };
    const [membership, ...companions] = await this.prisma.$transaction([
      this.prisma.membership.create({ data: shared, include: { member: true, plan: true } }),
      ...companionIds.map((memberId: string) =>
        this.prisma.membership.create({
          data: { ...shared, memberId, notes: shared.notes ?? 'Acompañante en plan compartido' },
        }),
      ),
    ]);
    companions.forEach(c => this.syncPass(c));
    return this.syncPass(membership);
  }

  /** Add one more person to a shared plan while it has free spots. */
  async addCompanion(membershipId: string, gymId: string, memberId: string) {
    const base = await this.prisma.membership.findFirst({
      where: { id: membershipId, gymId, status: 'ACTIVE' },
      include: { plan: { select: { maxMembers: true } } },
    });
    if (!base) throw new NotFoundException('Membresía activa no encontrada');
    if (!base.groupId || base.plan.maxMembers < 2) throw new BadRequestException('Este plan es individual');

    const taken = await this.prisma.membership.count({
      where: { groupId: base.groupId, status: { in: ['ACTIVE', 'FROZEN', 'SUSPENDED'] } },
    });
    if (taken >= base.plan.maxMembers) {
      throw new BadRequestException(`El plan ya cubre a ${base.plan.maxMembers} personas`);
    }
    await this.assertCompanions(gymId, base.memberId, [memberId]);

    const companion = await this.prisma.membership.create({
      data: {
        gymId,
        memberId,
        planId: base.planId,
        branchId: base.branchId,
        groupId: base.groupId,
        startDate: base.startDate,
        endDate: base.endDate,
        visitsTotal: base.visitsTotal,
        visitsUsed: 0,
        notes: 'Acompañante en plan compartido',
      },
      include: { member: true, plan: true },
    });
    return this.syncPass(companion);
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
    // A shared plan was paid once for everyone: credit only this person's share
    const proration = calculateProration({
      oldPlanPrice: Math.round(Number(current.plan.price) / (current.groupId ? Math.max(1, current.plan.maxMembers) : 1)),
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
          visitsTotal: newPlan.visitLimit,
          visitsUsed: 0,
          notes: data.notes ?? `Cambio desde "${current.plan.name}". Crédito aplicado: $${proration.creditApplied/100}`,
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
            `Crédito aplicado: $${proration.creditApplied/100}`,
            `Total cobrado: $${proration.amountDue/100}`,
          ].join(' | '),
        },
      });

      return { newMembership, payment };
    });

    this.syncPass(result.newMembership);
    return {
      proration,
      membership: result.newMembership,
      payment: result.payment,
      previousMembershipId: membershipId,
    };
  }

  async suspend(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.syncPass(await this.prisma.membership.update({ where: { id }, data: { status: 'SUSPENDED' } }));
  }

  async freeze(id: string, gymId: string) {
    await this.assertExists(id, gymId);
    return this.syncPass(await this.prisma.membership.update({
      where: { id },
      data: { status: 'FROZEN', frozenAt: new Date() },
    }));
  }

  async unfreeze(id: string, gymId: string) {
    const m = await this.assertExists(id, gymId);
    const frozenDays = m.frozenAt
      ? Math.ceil((Date.now() - m.frozenAt.getTime()) / 86_400_000)
      : 0;
    const newEndDate = new Date(m.endDate);
    newEndDate.setDate(newEndDate.getDate() + frozenDays);

    return this.syncPass(await this.prisma.membership.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        frozenAt: null,
        frozenDays: { increment: frozenDays },
        endDate: newEndDate,
      },
    }));
  }

  async cancel(id: string, gymId: string) {
    const m = await this.prisma.membership.findFirst({ where: { id, gymId } });
    if (!m) throw new NotFoundException('Miembresía no encontrada');
    return this.syncPass(await this.prisma.membership.update({ where: { id }, data: { status: 'CANCELLED' } }));
  }

  // ── Missed-days helpers ───────────────────────────────────

  private mondayOf(d: Date): Date {
    const day = d.getUTCDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  }

  async computeMissedDays(membershipId: string, gymId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, gymId },
      include: { plan: { select: { daysPerWeek: true } } },
    });
    if (!membership) throw new NotFoundException('Membresía no encontrada');

    const daysPerWeek = membership.plan.daysPerWeek ?? 0;
    const empty = { missedDays: 0, expectedDays: 0, attendedDays: 0, weeks: [] };
    if (daysPerWeek <= 0) return empty;

    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { schedule: true, timezone: true },
    });
    const schedule = (gym?.schedule ?? {}) as Record<string, { open: string; close: string } | null>;
    const tz = gym?.timezone ?? 'UTC';

    // sun=0, mon=1, ..., sat=6 → key mapping
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    // Today in gym timezone, as UTC midnight equivalent
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz });
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const today = new Date(Date.UTC(ty, tm - 1, td));
    const thisWeekMonday = this.mondayOf(today);

    const start = new Date(Date.UTC(
      membership.startDate.getUTCFullYear(),
      membership.startDate.getUTCMonth(),
      membership.startDate.getUTCDate(),
    ));

    // Only count weeks before current week
    if (thisWeekMonday <= start) return empty;

    const attendances = await this.prisma.attendance.findMany({
      where: { memberId: membership.memberId, gymId, checkIn: { gte: start, lt: thisWeekMonday } },
      select: { checkIn: true },
    });

    // Group attendance count by week-Monday key
    const attByWeek = new Map<string, number>();
    for (const att of attendances) {
      const key = this.mondayOf(att.checkIn).toISOString().slice(0, 10);
      attByWeek.set(key, (attByWeek.get(key) ?? 0) + 1);
    }

    const weeks: { weekStart: string; expected: number; attended: number; missed: number }[] = [];
    let totalExpected = 0, totalAttended = 0, totalMissed = 0;

    let weekStart = this.mondayOf(start);
    while (weekStart < thisWeekMonday) {
      let gymOpenThisWeek = 0;
      for (let i = 0; i < 7; i++) {
        const day = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + i));
        if (day < start) continue;                   // before membership start
        if (day >= thisWeekMonday) break;            // current/future week
        if (schedule[DAY_KEYS[day.getUTCDay()]] != null) gymOpenThisWeek++;
      }

      const expected = Math.min(daysPerWeek, gymOpenThisWeek);
      const weekKey = weekStart.toISOString().slice(0, 10);
      const attended = Math.min(attByWeek.get(weekKey) ?? 0, expected);
      const missed = Math.max(0, expected - attended);

      if (expected > 0) {
        weeks.push({ weekStart: weekKey, expected, attended, missed });
        totalExpected += expected;
        totalAttended += attended;
        totalMissed += missed;
      }

      weekStart = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate() + 7));
    }

    return { missedDays: totalMissed, expectedDays: totalExpected, attendedDays: totalAttended, weeks };
  }

  async applyMissedDays(membershipId: string, gymId: string) {
    const { missedDays, expectedDays, attendedDays } = await this.computeMissedDays(membershipId, gymId);
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, gymId } });
    if (!m) throw new NotFoundException('Membresía no encontrada');

    if (missedDays === 0) {
      return { missedDays: 0, oldEndDate: m.endDate, newEndDate: m.endDate, expectedDays, attendedDays };
    }

    const oldEndDate = new Date(m.endDate);
    const newEndDate = new Date(m.endDate);
    newEndDate.setUTCDate(newEndDate.getUTCDate() - missedDays);

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: { endDate: newEndDate },
    });

    return { missedDays, oldEndDate, newEndDate, expectedDays, attendedDays };
  }

  private async assertExists(id: string, gymId: string) {
    const m = await this.prisma.membership.findFirst({ where: { id, gymId } });
    if (!m) throw new NotFoundException('Miembresía no encontrada');
    return m;
  }

  // ── Cron: birthday WhatsApp (daily 9 AM UTC) ──────────────
  @Cron('0 9 * * *')
  async sendBirthdayEmails() {
    const now = new Date();

    if (!this.whatsapp.enabled) {
      this.logger.warn('[Birthday] WhatsApp not configured, skipping');
      return;
    }
    const planFlags = await getPlanFlagsByKey(this.prisma);
    const members = await this.prisma.member.findMany({
      where: { birthDate: { not: null }, isActive: true, phone: { not: null }, gym: { isActive: true } },
      select: {
        firstName: true,
        phone: true,
        birthDate: true,
        gymId: true,
        gym: { select: { name: true, timezone: true, country: true, subscriptionPlan: true } },
      },
    });

    const todayBirthdays = members.filter((m) => {
      if (!m.birthDate) return false;
      // Plan toggle set by super-admin (missing plan row → keep sending)
      if (planFlags.get(m.gym.subscriptionPlan)?.birthdayMessagesEnabled === false) return false;
      const tz = m.gym.timezone ?? 'UTC';
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz }); // "YYYY-MM-DD"
      const [, todayMonth, todayDay] = todayStr.split('-').map(Number);
      const b = new Date(m.birthDate);
      return b.getUTCMonth() + 1 === todayMonth && b.getUTCDate() === todayDay;
    });

    if (!todayBirthdays.length) return;

    let sent = 0;
    let skipped = 0;
    let noBalance = 0;
    await mapLimit(todayBirthdays, 5, async (m) => {
      const to = memberWhatsapp(m.phone, m.gym.country);
      if (!to) return skipped++;
      // Each greeting uses 1 message of the gym's monthly balance; none left → paused
      if (!(await this.quota.consume(m.gymId, 1, 'BIRTHDAY'))) return noBalance++;
      const res = await this.whatsapp.sendMemberTemplate(to, TEMPLATES.memberBirthday, [m.firstName, m.gym.name]);
      if (res.ok) sent++;
      else this.logger.error(`[Birthday] WhatsApp to ${to} failed: ${res.error}`);
    });
    this.logger.log(`[Birthday] Sent ${sent}/${todayBirthdays.length} WhatsApp greeting(s), ${skipped} without valid phone, ${noBalance} without message balance`);
  }

  // ── Cron: membership expiry reminders (daily 9 AM UTC) ───
  @Cron('0 9 * * *')
  async sendExpiryReminders() {
    const now = new Date();
    if (!this.whatsapp.enabled) {
      this.logger.warn('[ExpiryReminder] WhatsApp not configured, skipping');
      return;
    }

    // Fetch all gyms with timezone to build per-gym date ranges
    const allGyms = await this.prisma.gym.findMany({
      where: { isActive: true },
      select: { id: true, name: true, timezone: true, country: true, subscriptionPlan: true },
    });
    const planFlags = await getPlanFlagsByKey(this.prisma);

    // Build a UTC window covering all possible "in 2 days" across timezones (±14h)
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() + 1);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + 4);
    windowEnd.setHours(23, 59, 59, 999);

    const memberships = await this.prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: windowStart, lte: windowEnd },
      },
      include: {
        member: { select: { firstName: true, phone: true, isActive: true } },
        plan: { select: { name: true } },
      },
    });

    if (!memberships.length) return;

    const gymMap = new Map(allGyms.map((g) => [g.id, g]));

    // Filter to only memberships expiring in exactly 2 days in the gym's local timezone
    const target = memberships.filter((ms) => {
      const gym = gymMap.get(ms.gymId);
      if (!gym || !ms.member.phone || !ms.member.isActive) return false; // inactive gym/member or no phone
      if (planFlags.get(gym.subscriptionPlan)?.expiryRemindersEnabled === false) return false;
      const tz = gym.timezone ?? 'UTC';
      const in2DaysStr = new Date(now.getTime() + 2 * 86400000).toLocaleDateString('en-CA', { timeZone: tz });
      const rangeStart = startOfDayUTC(in2DaysStr, tz);
      const rangeEnd = endOfDayUTC(in2DaysStr, tz);
      return ms.endDate >= rangeStart && ms.endDate <= rangeEnd;
    });

    if (!target.length) return;

    let sent = 0;
    let skipped = 0;
    let noBalance = 0;
    await mapLimit(target, 5, async (ms) => {
      const gym = gymMap.get(ms.gymId)!;
      const to = memberWhatsapp(ms.member.phone, gym.country);
      if (!to) return skipped++;
      if (!(await this.quota.consume(ms.gymId, 1, 'EXPIRY'))) return noBalance++;
      const tz = gym.timezone ?? 'UTC';
      const endDate = ms.endDate.toLocaleDateString('es', { timeZone: tz, day: 'numeric', month: 'long' });
      const res = await this.whatsapp.sendMemberTemplate(to, TEMPLATES.memberExpiry, [
        ms.member.firstName,
        ms.plan.name,
        gym.name,
        endDate,
      ]);
      if (res.ok) sent++;
      else this.logger.error(`[ExpiryReminder] WhatsApp to ${to} failed: ${res.error}`);
    });
    this.logger.log(`[ExpiryReminder] Sent ${sent}/${target.length} WhatsApp reminder(s), ${skipped} without valid phone, ${noBalance} without message balance`);
  }
}
