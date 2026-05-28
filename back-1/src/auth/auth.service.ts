import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const REFRESH_TOKEN_DAYS = 30;

@Injectable()
export class AuthService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(data: {
    ownerName: string;
    email: string;
    phone?: string;
    gymName: string;
    planId?: string;
    isTrial?: boolean;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Ya existe una cuenta con ese email');

    let subPlan: { key: string; durationDays: number; graceDays: number } | null = null;
    if (data.planId) {
      subPlan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: data.planId },
        select: { key: true, durationDays: true, graceDays: true },
      });
    }
    if (!subPlan) {
      subPlan = await this.prisma.subscriptionPlan.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { key: true, durationDays: true, graceDays: true },
      }) ?? { key: 'BASIC', durationDays: 30, graceDays: 5 };
    }

    const baseSlug = toSlug(data.gymName) || 'gym';
    let slug = baseSlug;
    let attempt = 0;
    while (await this.prisma.gym.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++attempt}`;
    }

    const now = new Date();
    const TRIAL_DAYS = 30;

    const gymData: any = {
      name: data.gymName,
      slug,
      subscriptionPlan: subPlan.key,
    };

    if (data.isTrial) {
      const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      gymData.subscriptionStatus = 'TRIAL';
      gymData.trialEndsAt = trialEndsAt;
      gymData.isActive = true;
    } else {
      const subscriptionExpiresAt = new Date(now.getTime() + subPlan.durationDays * 24 * 60 * 60 * 1000);
      const subscriptionGraceEndsAt = new Date(subscriptionExpiresAt.getTime() + subPlan.graceDays * 24 * 60 * 60 * 1000);
      gymData.subscriptionStatus = 'ACTIVE';
      gymData.subscriptionExpiresAt = subscriptionExpiresAt;
      gymData.subscriptionGraceEndsAt = subscriptionGraceEndsAt;
      gymData.isActive = true;
    }

    const plainPassword = randomBytes(9).toString('base64url').slice(0, 12);
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const { user, gym } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: data.ownerName,
          email: data.email,
          password: hashedPassword,
          role: 'GYM_OWNER',
          isActive: true,
        },
      });

      const createdGym = await tx.gym.create({
        data: { ...gymData, ownerId: createdUser.id },
        select: { id: true, slug: true, name: true },
      });

      await tx.user.update({ where: { id: createdUser.id }, data: { gymId: createdGym.id } });

      return { user: createdUser, gym: createdGym };
    });

    this.sendWelcomeEmail(data.email, data.ownerName, gym.name, plainPassword).catch(() => null);

    const payload = { sub: user.id, email: user.email, role: user.role, gymId: gym.id, gymSlug: gym.slug };
    const access_token = this.jwt.sign(payload);
    const refresh_token = await this.createRefreshToken(user.id);

    return { access_token, refresh_token, gym: { slug: gym.slug } };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Credenciales incorrectas');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales incorrectas');

    let gymSlug: string | undefined;
    if (user.gymId) {
      const gym = await this.prisma.gym.findUnique({
        where: { id: user.gymId },
        select: { slug: true },
      });
      gymSlug = gym?.slug;
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      gymId: user.gymId ?? undefined,
      gymSlug,
    };

    const access_token = this.jwt.sign(payload);
    const refresh_token = await this.createRefreshToken(user.id);

    return {
      access_token,
      refresh_token,
      user: {
        userId: user.id,
        role: user.role,
        gymId: user.gymId,
        gymSlug,
      },
    };
  }

  async refresh(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await this.prisma.refreshToken.delete({ where: { tokenHash } });
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      await this.prisma.refreshToken.delete({ where: { tokenHash } });
      throw new UnauthorizedException('Usuario inactivo');
    }

    await this.prisma.refreshToken.delete({ where: { tokenHash } });

    let gymSlug: string | undefined;
    if (user.gymId) {
      const gym = await this.prisma.gym.findUnique({
        where: { id: user.gymId },
        select: { slug: true },
      });
      gymSlug = gym?.slug;
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      gymId: user.gymId ?? undefined,
      gymSlug,
    };

    const access_token = this.jwt.sign(payload);
    const refresh_token = await this.createRefreshToken(user.id);

    return { access_token, refresh_token };
  }

  async logout(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    return { message: 'Sesión cerrada' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async updateMe(userId: string, data: { name?: string; email?: string }) {
    if (data.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== userId) throw new ConflictException('Email ya en uso');
    }
    const safeData: { name?: string; email?: string } = {};
    if (data.name !== undefined) safeData.name = data.name;
    if (data.email !== undefined) safeData.email = data.email;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: safeData,
      select: { id: true, name: true, email: true, role: true },
    });
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new BadRequestException('La contraseña actual es incorrecta');

    if (newPassword.length < 8) throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    return { message: 'Contraseña actualizada correctamente' };
  }

  private async sendWelcomeEmail(email: string, ownerName: string, gymName: string, password: string) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: '1' } });
    const saasName = settings?.saasName ?? 'GymApp';
    const safeFirstName = escapeHtml(ownerName.split(' ')[0]);
    const safeGymName = escapeHtml(gymName);
    const safeEmail = escapeHtml(email);
    const safePassword = escapeHtml(password);
    const safeSaas = escapeHtml(saasName);

    await this.resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@tudominio.com',
      to: email,
      subject: `Bienvenido a ${saasName} — tus credenciales de acceso`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);border-radius:12px 12px 0 0;padding:40px 32px 32px;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">${safeSaas}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.6);font-size:14px;">Panel de Administración</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:40px 32px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">¡Hola, ${safeFirstName}! 👋</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Tu gimnasio <strong>${safeGymName}</strong> ha sido creado. Aquí están tus credenciales para acceder al panel.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:28px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 4px;color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;">Correo electrónico</p>
                <p style="margin:0 0 18px;color:#111827;font-size:15px;">${safeEmail}</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 18px;" />
                <p style="margin:0 0 4px;color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;">Contraseña temporal</p>
                <p style="margin:0;color:#111827;font-size:15px;font-family:'Courier New',monospace;background:#f3f4f6;display:inline-block;padding:6px 12px;border-radius:6px;letter-spacing:1px;">${safePassword}</p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${escapeHtml(frontendUrl)}/login" style="display:inline-block;background:linear-gradient(135deg,#0f3460,#1a1a2e);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;">
                  Iniciar sesión →
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#fffbeb;border:1px solid #fde68a;border-top:none;padding:16px 32px;">
            <p style="margin:0;color:#92400e;font-size:13px;">
              <strong>⚠️ Seguridad:</strong> Cambia tu contraseña al iniciar sesión por primera vez.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Correo enviado automáticamente por ${safeSaas}.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({ data: { tokenHash, userId, expiresAt } });

    return raw;
  }
}
