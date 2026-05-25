import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { calculateProration, centsToDecimal } from '../common/utils/proration.util';

const GRACE_DAYS = 5;

@Injectable()
export class SuperAdminService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  constructor(private readonly prisma: PrismaService) {}

  async findAllGyms() {
    return this.prisma.gym.findMany({
      include: { owner: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findGymById(id: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id },
      include: { owner: { select: { id: true, email: true, name: true } } },
    });
    if (!gym) throw new NotFoundException('Gym not found');
    return gym;
  }

  async createGym(data: any) {
    const { owner, ...gymData } = data;

    const planKey = gymData.subscriptionPlan ?? 'BASIC';
    const subPlan = await this.prisma.subscriptionPlan.findFirst({ where: { key: planKey } });
    const durationDays = subPlan?.durationDays ?? 30;
    const graceDays = subPlan?.graceDays ?? GRACE_DAYS;

    const now = new Date();
    const subscriptionExpiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const subscriptionGraceEndsAt = new Date(subscriptionExpiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000);

    const enrichedGymData = {
      ...gymData,
      subscriptionExpiresAt,
      subscriptionGraceEndsAt,
      subscriptionStatus: 'ACTIVE',
    };

    if (!owner) {
      return this.prisma.gym.create({ data: enrichedGymData });
    }

    const plainPassword = owner.password || (Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase());
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const existing = await this.prisma.user.findUnique({ where: { email: owner.email } });

    try {
      const gym = await this.prisma.$transaction(async (tx) => {
        let user: { id: string; email: string; name: string };

        if (existing) {
          await tx.gym.updateMany({
            where: { ownerId: existing.id },
            data: { ownerId: null },
          });

          user = await tx.user.update({
            where: { id: existing.id },
            data: { name: owner.name, password: hashedPassword, role: 'GYM_OWNER', isActive: true },
            select: { id: true, email: true, name: true },
          });
        } else {
          user = await tx.user.create({
            data: { email: owner.email, name: owner.name, password: hashedPassword, role: 'GYM_OWNER', isActive: true },
            select: { id: true, email: true, name: true },
          });
        }

        const createdGym = await tx.gym.create({
          data: { ...enrichedGymData, ownerId: user.id },
          include: { owner: { select: { id: true, email: true, name: true } } },
        });

        await tx.user.update({ where: { id: user.id }, data: { gymId: createdGym.id } });

        return createdGym;
      }, { timeout: 30000 });

      this.sendWelcomeEmail(owner.email, owner.name, gymData.name, plainPassword, gym.logoUrl ?? null).catch(() => null);

      return gym;
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        const fields = (err.meta?.target as string[]) ?? [];
        if (fields.includes('slug')) throw new ConflictException('Ya existe un gimnasio con ese nombre/slug');
        if (fields.includes('email')) throw new ConflictException('Ya existe un usuario con ese email');
        if (fields.includes('ownerId')) throw new ConflictException('Este usuario ya es dueño de otro gimnasio');
      }
      throw err;
    }
  }

  async getGymSubscription(gymId: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        id: true,
        name: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        subscriptionGraceEndsAt: true,
        isActive: true,
      },
    });
    if (!gym) throw new NotFoundException('Gym not found');

    const now = new Date();
    const daysUntilExpiry = gym.subscriptionExpiresAt
      ? Math.ceil((gym.subscriptionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      ...gym,
      daysUntilExpiry,
    };
  }

  async registerGymPayment(gymId: string, data: { amount: number; currency?: string; method?: string; notes?: string }) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true, subscriptionPlan: true, subscriptionStatus: true, subscriptionExpiresAt: true },
    });
    if (!gym) throw new NotFoundException('Gym not found');
    if (!data.amount || data.amount <= 0) throw new BadRequestException('Monto inválido');
    const amount = centsToDecimal(data.amount)!;

    const subPlan = await this.prisma.subscriptionPlan.findFirst({ where: { key: gym.subscriptionPlan } });
    const durationDays = subPlan?.durationDays ?? 30;
    const graceDays = subPlan?.graceDays ?? GRACE_DAYS;

    const now = new Date();
    const baseDate =
      gym.subscriptionStatus === 'ACTIVE' &&
      gym.subscriptionExpiresAt &&
      gym.subscriptionExpiresAt > now
        ? gym.subscriptionExpiresAt
        : now;

    const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const newGraceEnd = new Date(newExpiry.getTime() + graceDays * 24 * 60 * 60 * 1000);

    const [payment, updatedGym] = await this.prisma.$transaction([
      this.prisma.gymBillingPayment.create({
        data: {
          gymId,
          amount,
          currency: data.currency ?? 'USD',
          method: (data.method as any) ?? 'CASH',
          notes: data.notes,
          periodStart: baseDate,
          periodEnd: newExpiry,
        },
      }),
      this.prisma.gym.update({
        where: { id: gymId },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: newExpiry,
          subscriptionGraceEndsAt: newGraceEnd,
          isActive: true,
        },
        select: {
          id: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
          subscriptionGraceEndsAt: true,
          isActive: true,
        },
      }),
    ]);

    return { payment, gym: updatedGym };
  }

  async changeGymPlan(gymId: string, data: { planKey: string; amount?: number; method?: string; notes?: string }) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { id: true, subscriptionPlan: true, subscriptionStatus: true, subscriptionExpiresAt: true },
    });
    if (!gym) throw new NotFoundException('Gym not found');
    if (gym.subscriptionPlan === data.planKey) throw new BadRequestException('El gym ya tiene ese plan');

    const [oldPlan, newPlan] = await Promise.all([
      this.prisma.subscriptionPlan.findFirst({ where: { key: gym.subscriptionPlan } }),
      this.prisma.subscriptionPlan.findFirst({ where: { key: data.planKey } }),
    ]);
    if (!newPlan) throw new NotFoundException(`Plan "${data.planKey}" no encontrado`);

    const now = new Date();

    const latestPayment = await this.prisma.gymBillingPayment.findFirst({
      where: { gymId },
      orderBy: { periodStart: 'desc' },
    });

    const periodStart = latestPayment?.periodStart ?? gym.subscriptionExpiresAt
      ? new Date((gym.subscriptionExpiresAt!.getTime()) - ((oldPlan?.durationDays ?? 30) * 24 * 60 * 60 * 1000))
      : new Date(now.getTime() - 1);

    const newPlanPrice = data.amount !== undefined
      ? centsToDecimal(data.amount)!
      : Number(newPlan.price);

    const proration = calculateProration({
      oldPlanPrice: Number(oldPlan?.price ?? 0),
      oldPlanDurationDays: oldPlan?.durationDays ?? 30,
      periodStart,
      newPlanPrice,
      changeDate: now,
    });

    const newDurationDays = newPlan.durationDays;
    const graceDays = newPlan.graceDays ?? GRACE_DAYS;
    const newExpiry = new Date(now.getTime() + newDurationDays * 24 * 60 * 60 * 1000);
    const newGraceEnd = new Date(newExpiry.getTime() + graceDays * 24 * 60 * 60 * 1000);

    const [payment, updatedGym] = await this.prisma.$transaction([
      this.prisma.gymBillingPayment.create({
        data: {
          gymId,
          amount: proration.amountDue,
          currency: newPlan.currency,
          method: (data.method as any) ?? 'CASH',
          periodStart: now,
          periodEnd: newExpiry,
          notes: data.notes ?? [
            `Cambio de plan: "${gym.subscriptionPlan}" → "${data.planKey}"`,
            `Días restantes anteriores: ${proration.daysRemaining}`,
            `Crédito aplicado: $${proration.creditApplied}`,
            `Total cobrado: $${proration.amountDue}`,
          ].join(' | '),
        },
      }),
      this.prisma.gym.update({
        where: { id: gymId },
        data: {
          subscriptionPlan: data.planKey,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: newExpiry,
          subscriptionGraceEndsAt: newGraceEnd,
          isActive: true,
        },
        select: {
          id: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
          subscriptionGraceEndsAt: true,
        },
      }),
    ]);

    return { proration, payment, gym: updatedGym };
  }

  async getGymBillingHistory(gymId: string) {
    await this.assertGymExists(gymId);
    return this.prisma.gymBillingPayment.findMany({
      where: { gymId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteGymBillingPayment(gymId: string, paymentId: string) {
    await this.assertGymExists(gymId);
    const payment = await this.prisma.gymBillingPayment.findFirst({ where: { id: paymentId, gymId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    await this.prisma.gymBillingPayment.delete({ where: { id: paymentId } });

    const latestPayment = await this.prisma.gymBillingPayment.findFirst({
      where: { gymId },
      orderBy: { periodEnd: 'desc' },
    });

    const now = new Date();

    if (!latestPayment) {
      await this.prisma.gym.update({
        where: { id: gymId },
        data: {
          subscriptionExpiresAt: null,
          subscriptionGraceEndsAt: null,
          subscriptionStatus: 'SUSPENDED',
          isActive: false,
        },
      });
      return { message: 'Pago eliminado. Sin pagos restantes — suscripción suspendida.' };
    }

    const subPlan = await this.prisma.subscriptionPlan.findFirst({
      where: { key: (await this.prisma.gym.findUnique({ where: { id: gymId }, select: { subscriptionPlan: true } }))!.subscriptionPlan },
    });
    const graceDays = subPlan?.graceDays ?? GRACE_DAYS;
    const newGraceEnd = new Date(latestPayment.periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);

    let status: 'ACTIVE' | 'GRACE' | 'SUSPENDED';
    if (latestPayment.periodEnd > now) {
      status = 'ACTIVE';
    } else if (newGraceEnd > now) {
      status = 'GRACE';
    } else {
      status = 'SUSPENDED';
    }

    await this.prisma.gym.update({
      where: { id: gymId },
      data: {
        subscriptionExpiresAt: latestPayment.periodEnd,
        subscriptionGraceEndsAt: newGraceEnd,
        subscriptionStatus: status,
        isActive: status !== 'SUSPENDED',
      },
    });

    return { message: 'Pago eliminado. Suscripción recalculada.', subscriptionStatus: status, subscriptionExpiresAt: latestPayment.periodEnd };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkSubscriptions() {
    const now = new Date();

    await this.prisma.gym.updateMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: { lt: now },
      },
      data: { subscriptionStatus: 'GRACE' },
    });

    await this.prisma.gym.updateMany({
      where: {
        subscriptionStatus: 'GRACE',
        subscriptionGraceEndsAt: { lt: now },
      },
      data: {
        subscriptionStatus: 'SUSPENDED',
        isActive: false,
      },
    });
  }

  private async sendWelcomeEmail(email: string, ownerName: string, gymName: string, password: string, logoUrl: string | null) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const firstName = ownerName.split(' ')[0];
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001';
    const logoSrc = logoUrl
      ? (logoUrl.startsWith('http') ? logoUrl : `${backendUrl}${logoUrl}`)
      : null;
    const logoHtml = logoSrc
      ? `<img src="${logoSrc}" alt="${gymName}" style="width:56px;height:56px;border-radius:12px;object-fit:cover;" />`
      : `<div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;"><span style="font-size:28px;">🏋️</span></div>`;

    await this.resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@tudominio.com',
      to: email,
      subject: `¡Bienvenido a ${gymName}! Tus credenciales de acceso`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a ${gymName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:12px 12px 0 0;padding:40px 32px 32px;">
              <div style="margin-bottom:16px;">${logoHtml}</div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">${gymName}</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.6);font-size:14px;">Panel de Administración</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 32px;">
              <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:600;">¡Hola, ${firstName}! 👋</h2>
              <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                Tu gimnasio ha sido creado exitosamente. Aquí están tus credenciales para acceder al panel de administración.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;">Correo electrónico</p>
                    <p style="margin:0 0 18px;color:#111827;font-size:15px;font-weight:500;">${email}</p>
                    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 18px;" />
                    <p style="margin:0 0 4px;color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;">Contraseña temporal</p>
                    <p style="margin:0;color:#111827;font-size:15px;font-weight:500;font-family:'Courier New',monospace;background:#f3f4f6;display:inline-block;padding:6px 12px;border-radius:6px;letter-spacing:1px;">${password}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${frontendUrl}/login"
                       style="display:inline-block;background:linear-gradient(135deg,#0f3460,#1a1a2e);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      Iniciar sesión →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Warning -->
          <tr>
            <td style="background:#fffbeb;border:1px solid #fde68a;border-top:none;padding:16px 32px;">
              <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
                <strong>⚠️ Seguridad:</strong> Cambia tu contraseña al iniciar sesión por primera vez. No compartas estas credenciales.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Este correo fue enviado automáticamente por el sistema de gestión de ${gymName}.<br/>
                Si no esperabas este correo, puedes ignorarlo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });
  }

  async updateGym(id: string, data: any) {
    await this.assertGymExists(id);
    return this.prisma.gym.update({
      where: { id },
      data,
      include: { owner: { select: { id: true, email: true, name: true } } },
    });
  }

  async setGymActive(id: string, isActive: boolean) {
    await this.assertGymExists(id);
    return this.prisma.gym.update({ where: { id }, data: { isActive } });
  }

  async assignOwner(gymId: string, ownerId: string) {
    await this.assertGymExists(gymId);
    return this.prisma.gym.update({ where: { id: gymId }, data: { ownerId } });
  }

  async resendWelcomeEmail(gymId: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: { owner: { select: { id: true, email: true, name: true } } },
    });
    if (!gym) throw new NotFoundException('Gym not found');
    if (!gym.owner) throw new NotFoundException('Este gimnasio no tiene dueño asignado');

    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    const hashed = await bcrypt.hash(tempPassword, 10);
    await this.prisma.user.update({ where: { id: gym.owner.id }, data: { password: hashed } });

    await this.sendWelcomeEmail(gym.owner.email, gym.owner.name, gym.name, tempPassword, gym.logoUrl ?? null);
    return { message: 'Correo de bienvenida reenviado' };
  }

  async updateOwnerProfile(gymId: string, data: { name?: string; email?: string; password?: string }) {
    const gym = await this.assertGymExists(gymId);
    if (!gym.ownerId) throw new NotFoundException('Este gimnasio no tiene dueño asignado');

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10);

    return this.prisma.user.update({ where: { id: gym.ownerId }, data: updateData, select: { id: true, name: true, email: true } });
  }

  async deleteGym(id: string) {
    await this.assertGymExists(id);
    return this.prisma.gym.delete({ where: { id } });
  }

  async getSubscriptionPlans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createSubscriptionPlan(data: any) {
    const payload = { ...data };
    if (data.price !== undefined) payload.price = Math.round(Number(data.price) * 100);
    return this.prisma.subscriptionPlan.create({ data: payload });
  }

  async updateSubscriptionPlan(id: string, data: any) {
    const payload = { ...data };
    if (data.price !== undefined) payload.price = Math.round(Number(data.price) * 100);
    return this.prisma.subscriptionPlan.update({ where: { id }, data: payload });
  }

  async deleteSubscriptionPlan(id: string) {
    return this.prisma.subscriptionPlan.delete({ where: { id } });
  }

  async getPlatformSettings() {
    return this.prisma.platformSettings.upsert({
      where: { id: '1' },
      create: { id: '1' },
      update: {},
    });
  }

  async updatePlatformLogo(logoUrl: string) {
    return this.prisma.platformSettings.upsert({
      where: { id: '1' },
      create: { id: '1', logoUrl },
      update: { logoUrl },
    });
  }

  async updatePlatformSettings(data: {
    saasName?: string;
    logoUrl?: string | null;
    creatorName?: string | null;
    creatorUrl?: string | null;
    footerText?: string | null;
    footerLinks?: Array<{ label: string; url: string }>;
    footerShowPoweredBy?: boolean;
    heroTitle?: string | null;
    heroSubtitle?: string | null;
    heroCtaText?: string | null;
    heroCtaUrl?: string | null;
    primaryColor?: string | null;
    landingFeatures?: Array<{ title: string; description: string }>;
    landingShowPlans?: boolean;
    termsContent?: string | null;
  }) {
    return this.prisma.platformSettings.upsert({
      where: { id: '1' },
      create: { id: '1', ...data },
      update: data,
    });
  }

  async getDashboard() {
    const [totalGyms, activeGyms, totalUsers, totalMembers] = await Promise.all([
      this.prisma.gym.count(),
      this.prisma.gym.count({ where: { isActive: true } }),
      this.prisma.user.count(),
      this.prisma.member.count(),
    ]);
    return {
      totalGyms,
      activeGyms,
      inactiveGyms: totalGyms - activeGyms,
      totalUsers,
      totalMembers,
    };
  }

  private async assertGymExists(id: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id } });
    if (!gym) throw new NotFoundException('Gym not found');
    return gym;
  }
}
