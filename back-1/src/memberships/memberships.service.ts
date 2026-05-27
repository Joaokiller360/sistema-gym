import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { calculateProration } from '../common/utils/proration.util';

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

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
    const m = await this.prisma.membership.findFirst({ where: { id, gymId } });
    if (!m) throw new NotFoundException('Miembresía no encontrada');
    return this.prisma.membership.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  private async assertExists(id: string, gymId: string) {
    const m = await this.prisma.membership.findFirst({ where: { id, gymId } });
    if (!m) throw new NotFoundException('Miembresía no encontrada');
    return m;
  }

  // ── Cron: birthday emails (daily 9 AM UTC) ────────────────
  @Cron('0 9 * * *')
  async sendBirthdayEmails() {
    const today = new Date();
    const month = today.getMonth();
    const day = today.getDate();

    const members = await this.prisma.member.findMany({
      where: { birthDate: { not: null }, isActive: true },
      include: { gym: { select: { name: true } } },
    });

    const todayBirthdays = members.filter((m) => {
      if (!m.birthDate) return false;
      const b = new Date(m.birthDate);
      return b.getMonth() === month && b.getDate() === day;
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
    const in2Days = new Date(now);
    in2Days.setDate(in2Days.getDate() + 2);
    in2Days.setHours(0, 0, 0, 0);
    const in3Days = new Date(in2Days);
    in3Days.setDate(in3Days.getDate() + 1);

    const memberships = await this.prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: in2Days, lt: in3Days },
      },
      include: {
        member: { select: { firstName: true, email: true } },
        plan: { select: { name: true, price: true, currency: true } },
      },
    });

    if (!memberships.length) return;

    const gymIds = [...new Set(memberships.map((ms) => ms.gymId))];
    const gyms = await this.prisma.gym.findMany({
      where: { id: { in: gymIds } },
      select: { id: true, name: true },
    });
    const gymMap = new Map(gyms.map((g) => [g.id, g.name]));

    const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@tudominio.com';
    const results = await Promise.allSettled(
      memberships.map((ms) =>
        this.resend.emails.send({
          from,
          to: ms.member.email,
          subject: `⏰ Tu membresía vence en 2 días — ${gymMap.get(ms.gymId) ?? 'tu gimnasio'}`,
          html: this.buildExpiryReminderHtml(
            ms.member.firstName,
            gymMap.get(ms.gymId) ?? 'tu gimnasio',
            ms.plan.name,
            ms.endDate,
          ),
        }),
      ),
    );

    for (const r of results) {
      if (r.status === 'rejected') this.logger.error('[ExpiryReminder] Email failed:', r.reason);
    }
    this.logger.log(`[ExpiryReminder] Sent ${memberships.length} expiry reminder(s)`);
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
