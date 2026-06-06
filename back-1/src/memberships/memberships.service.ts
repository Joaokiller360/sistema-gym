import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { calculateProration } from '../common/utils/proration.util';
import { startOfDayUTC, endOfDayUTC } from '../common/utils/timezone.util';

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  constructor(private readonly prisma: PrismaService) {}

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
    const m = await this.prisma.membership.findFirst({ where: { id, gymId } });
    if (!m) throw new NotFoundException('Miembresía no encontrada');
    return this.prisma.membership.update({ where: { id }, data: { status: 'CANCELLED' } });
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

  // ── Cron: birthday emails (daily 9 AM UTC) ────────────────
  @Cron('0 9 * * *')
  async sendBirthdayEmails() {
    const now = new Date();

    const members = await this.prisma.member.findMany({
      where: { birthDate: { not: null }, isActive: true },
      include: { gym: { select: { name: true, timezone: true } } },
    });

    const todayBirthdays = members.filter((m) => {
      if (!m.birthDate) return false;
      const tz = m.gym.timezone ?? 'UTC';
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz }); // "YYYY-MM-DD"
      const [, todayMonth, todayDay] = todayStr.split('-').map(Number);
      const b = new Date(m.birthDate);
      return b.getUTCMonth() + 1 === todayMonth && b.getUTCDate() === todayDay;
    });

    if (!todayBirthdays.length) return;

    const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@tudominio.com';
    const results = await Promise.allSettled(
      todayBirthdays.map((m) =>
        this.resend.emails.send({
          from,
          to: m.email,
          subject: `🎂 ¡Feliz cumpleaños, ${m.firstName}!`,
          html: this.buildBirthdayHtml(m.firstName, m.gym.name),
        }),
      ),
    );

    for (const r of results) {
      if (r.status === 'rejected') this.logger.error('[Birthday] Email failed:', r.reason);
    }
    this.logger.log(`[Birthday] Sent ${todayBirthdays.length} birthday email(s)`);
  }

  // ── Cron: membership expiry reminders (daily 9 AM UTC) ───
  @Cron('0 9 * * *')
  async sendExpiryReminders() {
    const now = new Date();

    // Fetch all gyms with timezone to build per-gym date ranges
    const allGyms = await this.prisma.gym.findMany({
      where: { isActive: true },
      select: { id: true, name: true, timezone: true },
    });

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
        member: { select: { firstName: true, email: true } },
        plan: { select: { name: true, price: true, currency: true } },
      },
    });

    if (!memberships.length) return;

    const gymMap = new Map(allGyms.map((g) => [g.id, g]));

    // Filter to only memberships expiring in exactly 2 days in the gym's local timezone
    const target = memberships.filter((ms) => {
      const gym = gymMap.get(ms.gymId);
      const tz = gym?.timezone ?? 'UTC';
      const in2DaysStr = new Date(now.getTime() + 2 * 86400000).toLocaleDateString('en-CA', { timeZone: tz });
      const rangeStart = startOfDayUTC(in2DaysStr, tz);
      const rangeEnd = endOfDayUTC(in2DaysStr, tz);
      return ms.endDate >= rangeStart && ms.endDate <= rangeEnd;
    });

    if (!target.length) return;

    const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@tudominio.com';
    const results = await Promise.allSettled(
      target.map((ms) =>
        this.resend.emails.send({
          from,
          to: ms.member.email,
          subject: `⏰ Tu membresía vence en 2 días — ${gymMap.get(ms.gymId)?.name ?? 'tu gimnasio'}`,
          html: this.buildExpiryReminderHtml(
            ms.member.firstName,
            gymMap.get(ms.gymId)?.name ?? 'tu gimnasio',
            ms.plan.name,
            ms.endDate,
          ),
        }),
      ),
    );

    for (const r of results) {
      if (r.status === 'rejected') this.logger.error('[ExpiryReminder] Email failed:', r.reason);
    }
    this.logger.log(`[ExpiryReminder] Sent ${target.length} expiry reminder(s)`);
  }

  // ── Email templates ───────────────────────────────────────
  private buildBirthdayHtml(firstName: string, gymName: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><title>¡Feliz cumpleaños!</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:12px 12px 0 0;padding:48px 32px 40px;">
            <div style="font-size:56px;margin-bottom:16px;">🎂</div>
            <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">¡Feliz cumpleaños, ${firstName}!</h1>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:36px 32px 32px;text-align:center;">
            <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
              Todo el equipo de <strong>${gymName}</strong> te desea un increíble día lleno de salud, fuerza y alegría. 💪
            </p>
            <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
              Gracias por elegirnos para alcanzar tus metas. ¡Seguí entrenando con toda la energía!
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              Este correo fue enviado por <strong>${gymName}</strong> a través de Sistema Gym.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private buildExpiryReminderHtml(
    firstName: string,
    gymName: string,
    planName: string,
    endDate: Date,
  ): string {
    const dateStr = endDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><title>Tu membresía vence pronto</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:12px 12px 0 0;padding:48px 32px 40px;">
            <div style="font-size:48px;margin-bottom:16px;">⏰</div>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Tu membresía vence en 2 días</h1>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:36px 32px 32px;">
            <p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.6;">
              Hola <strong>${firstName}</strong>,
            </p>
            <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
              Tu membresía <strong>${planName}</strong> en <strong>${gymName}</strong> vence el <strong>${dateStr}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0;color:#92400e;font-size:14px;font-weight:600;">⚠️ Recordatorio</p>
                <p style="margin:4px 0 0;color:#92400e;font-size:14px;">Renovate antes del vencimiento para no interrumpir tu acceso al gimnasio.</p>
              </td></tr>
            </table>
            <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
              Para renovar, acercate al gimnasio o contactá a tu administrador.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              Este correo fue enviado por <strong>${gymName}</strong> a través de Sistema Gym.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
