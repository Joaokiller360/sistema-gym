import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizeHtml = require('sanitize-html') as (input: string, opts: object) => string;
import { PrismaService } from '../prisma/prisma.service';
import { isGymOpen, GymSchedule } from '../common/utils/timezone.util';

function sanitizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}

function generateSecurePassword(length = 14): string {
  return randomBytes(length).toString('base64url').slice(0, length);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class GymsService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        address: true,
        country: true,
        timezone: true,
        currency: true,
        schedule: true,
        isActive: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        advancedReportsEnabled: true,
      },
    });
    if (!gym) throw new NotFoundException('Gym not found');
    const subscriptionPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { key: gym.subscriptionPlan },
      select: { storeEnabled: true, advancedReportsEnabled: true, demoEnabled: true },
    });
    const storeEnabled = subscriptionPlan?.storeEnabled ?? false;
    const advancedReportsEnabled = gym.advancedReportsEnabled || (subscriptionPlan?.advancedReportsEnabled ?? false);
    const demoEnabled = subscriptionPlan?.demoEnabled ?? false;
    return { ...gym, storeEnabled, advancedReportsEnabled, demoEnabled };
  }

  async getStatus(slug: string) {
    const gym = await this.prisma.gym.findUnique({ where: { slug }, select: { timezone: true, schedule: true } });
    if (!gym) throw new NotFoundException('Gym not found');
    const tz = gym.timezone ?? 'UTC';
    const now = new Date();
    const localTime = now.toLocaleTimeString('es', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const isOpen = gym.schedule ? isGymOpen(gym.schedule as GymSchedule, tz, now) : null;
    return { timezone: tz, localTime, isOpen };
  }

  async update(id: string, data: any, callerId: string, role?: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id } });
    if (!gym) throw new NotFoundException('Gym not found');

    if (role !== 'SUPER_ADMIN' && gym.ownerId !== callerId) {
      throw new ForbiddenException('No autorizado');
    }

    const OWNER_ALLOWED = ['name', 'address', 'country', 'timezone', 'currency', 'schedule', 'phone', 'email'];
    const SUPER_ALLOWED = [...OWNER_ALLOWED, 'slug', 'isActive', 'subscriptionPlan', 'subscriptionStatus', 'subscriptionExpiresAt', 'subscriptionGraceEndsAt', 'ownerId'];

    const TEXT_FIELDS = new Set(['name', 'address', 'phone', 'email']);
    const allowed = role === 'SUPER_ADMIN' ? SUPER_ALLOWED : OWNER_ALLOWED;
    const safeData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (!allowed.includes(k)) continue;
      safeData[k] = TEXT_FIELDS.has(k) ? sanitizeText(v) ?? v : v;
    }

    return this.prisma.gym.update({ where: { id }, data: safeData });
  }

  async remove(id: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id } });
    if (!gym) throw new NotFoundException('Gym not found');
    await this.prisma.gym.delete({ where: { id } });
    return { message: 'Gym deleted successfully' };
  }

  async updateLogo(id: string, logoUrl: string, callerId: string, role?: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id } });
    if (!gym) throw new NotFoundException('Gym not found');

    if (role !== 'SUPER_ADMIN' && gym.ownerId !== callerId) {
      throw new ForbiddenException('No autorizado');
    }

    if (gym.logoUrl?.startsWith('/uploads/logos/')) {
      const oldPath = join(process.cwd(), gym.logoUrl);
      unlink(oldPath).catch(() => null);
    }

    return this.prisma.gym.update({ where: { id }, data: { logoUrl } });
  }

  async getStaff(gymId: string) {
    return this.prisma.user.findMany({
      where: { gymId, role: 'GYM_ADMIN' },
      select: { id: true, name: true, email: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStaff(gymId: string, name: string, email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese email');

    const tempPassword = generateSecurePassword();
    const hashed = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: { name, email, password: hashed, role: 'GYM_ADMIN', gymId, isActive: true },
      select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    });

    // The admin is already created; a mail failure only means the owner shares the password by hand
    const emailSent = await this.sendStaffWelcomeEmail(gymId, name, email, tempPassword)
      .then(() => true)
      .catch(() => false);

    return { ...user, tempPassword, emailSent };
  }

  private async sendStaffWelcomeEmail(gymId: string, name: string, email: string, password: string) {
    const [gym, settings] = await Promise.all([
      this.prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } }),
      this.prisma.platformSettings.findUnique({ where: { id: '1' } }),
    ]);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const saasName = escapeHtml(settings?.saasName ?? 'GymApp');
    const firstName = escapeHtml(name.split(' ')[0]);
    const gymName = escapeHtml(gym?.name ?? '');

    const { error } = await this.resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@tudominio.com',
      to: email,
      subject: `Te invitaron a administrar ${gym?.name ?? 'tu gimnasio'} — tus credenciales de acceso`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td align="center" style="background:#0b0b0c;border-radius:12px 12px 0 0;padding:36px 32px 28px;">
            <h1 style="margin:0;color:#fffb00;font-size:24px;font-weight:800;">${saasName}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.6);font-size:14px;">Panel de recepción</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:36px 32px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">¡Hola, ${firstName}!</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Te dieron acceso como administrador de <strong>${gymName}</strong>. Desde el panel vas a poder registrar entradas, atender a los socios y cobrar.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:28px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 4px;color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;">Correo electrónico</p>
                <p style="margin:0 0 18px;color:#111827;font-size:15px;">${escapeHtml(email)}</p>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 18px;" />
                <p style="margin:0 0 4px;color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;">Contraseña temporal</p>
                <p style="margin:0;color:#111827;font-size:15px;font-family:'Courier New',monospace;background:#f3f4f6;display:inline-block;padding:6px 12px;border-radius:6px;letter-spacing:1px;">${escapeHtml(password)}</p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${escapeHtml(frontendUrl)}/login" style="display:inline-block;background:#0b0b0c;color:#fffb00;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">
                  Iniciar sesión →
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#fffbeb;border:1px solid #fde68a;border-top:none;padding:16px 32px;">
            <p style="margin:0;color:#92400e;font-size:13px;">
              <strong>Seguridad:</strong> cambia tu contraseña desde "Mi cuenta" al iniciar sesión por primera vez.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Correo enviado automáticamente por ${saasName}.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
    if (error) throw new Error(error.message);
  }

  async removeStaff(gymId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, gymId, role: 'GYM_ADMIN' } });
    if (!user) throw new NotFoundException('Administrador no encontrado');
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Administrador eliminado' };
  }
}
