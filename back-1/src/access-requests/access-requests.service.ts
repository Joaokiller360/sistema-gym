import { Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizeHtml = require('sanitize-html') as (input: string, opts: object) => string;
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { AccessRequestStatus } from '@prisma/client';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

function sanitizeText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

@Injectable()
export class AccessRequestsService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAccessRequestDto) {
    const preferred = new Date(dto.preferredDate);
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);

    if (preferred < tomorrow) {
      throw new BadRequestException('preferredDate must be at least tomorrow');
    }
    if (preferred > maxDate) {
      throw new BadRequestException('preferredDate must be within 1 year');
    }

    await this.prisma.accessRequest.create({
      data: {
        name: sanitizeText(dto.name),
        email: dto.email.toLowerCase().trim(),
        phone: dto.phone ? sanitizeText(dto.phone) : null,
        preferredDate: preferred,
      },
    });

    return { success: true };
  }

  async findAll(limit: number) {
    return this.prisma.accessRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      select: { id: true, name: true, email: true, phone: true, preferredDate: true, status: true, createdAt: true },
    });
  }

  async updateStatus(id: string, status: AccessRequestStatus) {
    const record = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Access request not found');
    return this.prisma.accessRequest.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, email: true, phone: true, preferredDate: true, status: true, createdAt: true },
    });
  }

  async sendMessage(id: string, message: string, meetingLink?: string) {
    const record = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Access request not found');

    const platform = await this.prisma.platformSettings.findFirst();
    const saasName = escapeHtml(platform?.saasName ?? 'GymOS');
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com';

    const safeName = escapeHtml(record.name);
    const safeEmail = escapeHtml(record.email);
    const safePhone = record.phone ? escapeHtml(record.phone) : null;
    const safePreferredDate = escapeHtml(
      record.preferredDate.toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' }),
    );
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
    const safeMeetingLink = meetingLink ? escapeHtml(meetingLink) : null;

    const meetingBlock = safeMeetingLink
      ? `
          <tr>
            <td style="padding:0 0 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 12px;color:#166534;font-size:14px;font-weight:600;">Reunión programada</p>
                    <a href="${safeMeetingLink}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;">
                      Unirse a la reunión
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : '';

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Respuesta a tu solicitud — ${saasName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:12px 12px 0 0;padding:36px 32px 28px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">${saasName}</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Respuesta a tu solicitud de acceso</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px;">
              <h2 style="margin:0 0 6px;color:#111827;font-size:18px;font-weight:600;">Hola, ${safeName}</h2>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">Hemos revisado tu solicitud y queremos comunicarnos contigo.</p>

              <!-- Message -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#f9fafb;border-left:4px solid #111827;border-radius:0 8px 8px 0;padding:16px 20px;">
                    <p style="margin:0;color:#111827;font-size:14px;line-height:1.7;">${safeMessage}</p>
                  </td>
                </tr>
              </table>

              ${meetingBlock}

              <!-- Original request summary -->
              <p style="margin:0 0 12px;color:#374151;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Datos de tu solicitud</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <tr><td style="padding:4px 0;">
                  <span style="color:#6b7280;font-size:13px;">Nombre: </span>
                  <span style="color:#111827;font-size:13px;font-weight:500;">${safeName}</span>
                </td></tr>
                <tr><td style="padding:4px 0;">
                  <span style="color:#6b7280;font-size:13px;">Email: </span>
                  <span style="color:#111827;font-size:13px;font-weight:500;">${safeEmail}</span>
                </td></tr>
                ${safePhone ? `<tr><td style="padding:4px 0;">
                  <span style="color:#6b7280;font-size:13px;">Teléfono: </span>
                  <span style="color:#111827;font-size:13px;font-weight:500;">${safePhone}</span>
                </td></tr>` : ''}
                <tr><td style="padding:4px 0;">
                  <span style="color:#6b7280;font-size:13px;">Fecha preferida: </span>
                  <span style="color:#111827;font-size:13px;font-weight:500;">${safePreferredDate}</span>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">Este mensaje fue enviado por ${saasName}. Por favor no respondas a este correo.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const { error } = await this.resend.emails.send({
      from: fromEmail,
      to: record.email,
      subject: `Respuesta a tu solicitud de acceso — ${platform?.saasName ?? 'GymOS'}`,
      html,
    });

    if (error) {
      throw new InternalServerErrorException('Failed to send email');
    }

    return { success: true };
  }

  async convert(id: string, gymName: string, adminId: string): Promise<{ gymSlug: string }> {
    // Validate gymName server-side
    const clean = sanitizeText(gymName);
    if (clean.length < 2 || clean.length > 80) {
      throw new BadRequestException('gymName must be between 2 and 80 characters');
    }
    if (!/^[a-zA-ZÀ-ÿ0-9\s.,'-]+$/.test(clean)) {
      throw new BadRequestException('gymName contains invalid characters');
    }

    const record = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Access request not found');
    if (record.status === 'CONVERTED') throw new ConflictException('Access request already converted');

    const existingUser = await this.prisma.user.findUnique({ where: { email: record.email } });
    if (existingUser) throw new ConflictException('A user with this email already exists');

    const plainPassword = randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const platform = await this.prisma.platformSettings.findFirst();
    const saasName = platform?.saasName ?? 'GymOS';
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com';
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    // Generate unique slug
    let baseSlug = generateSlug(clean);
    if (!baseSlug) baseSlug = 'gym';
    let slug = baseSlug;
    const existing = await this.prisma.gym.findUnique({ where: { slug } });
    if (existing) {
      slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
    }

    const gym = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: record.email, name: record.name, role: 'GYM_OWNER', password: hashedPassword, isActive: true },
        select: { id: true },
      });

      const createdGym = await tx.gym.create({
        data: { name: clean, slug, ownerId: user.id, isActive: true, subscriptionStatus: 'TRIAL' },
        select: { id: true, slug: true },
      });

      await tx.user.update({ where: { id: user.id }, data: { gymId: createdGym.id } });

      await tx.accessRequest.update({
        where: { id },
        data: {
          status: 'CONVERTED',
          convertedAt: new Date(),
          convertedById: adminId,
          convertedGymId: createdGym.id,
        },
      });

      return createdGym;
    }, { timeout: 30000 });

    // Send credentials email — fire and forget
    this.sendConvertEmail(record.email, record.name, clean, plainPassword, frontendUrl, saasName, fromEmail).catch(() => null);

    return { gymSlug: gym.slug };
  }

  private async sendConvertEmail(
    email: string,
    ownerName: string,
    gymName: string,
    plainPassword: string,
    frontendUrl: string,
    saasName: string,
    fromEmail: string,
  ) {
    const safeName = escapeHtml(ownerName.split(' ')[0]);
    const safeGym = escapeHtml(gymName);
    const safeEmail = escapeHtml(email);
    const safePassword = escapeHtml(plainPassword);
    const safeSaas = escapeHtml(saasName);
    const safeUrl = escapeHtml(frontendUrl);

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:12px 12px 0 0;padding:36px 32px 28px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${safeSaas}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">¡Tu acceso está listo!</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:36px 32px;">
            <h2 style="margin:0 0 6px;color:#111827;font-size:18px;font-weight:600;">¡Hola, ${safeName}! 👋</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
              Tu gimnasio <strong>${safeGym}</strong> ha sido creado. Aquí están tus credenciales de acceso:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
              <tr><td style="padding:4px 0;">
                <span style="color:#6b7280;font-size:13px;">Email: </span>
                <span style="color:#111827;font-size:13px;font-weight:600;">${safeEmail}</span>
              </td></tr>
              <tr><td style="padding:4px 0;">
                <span style="color:#6b7280;font-size:13px;">Contraseña temporal: </span>
                <span style="color:#111827;font-size:13px;font-weight:600;font-family:monospace;">${safePassword}</span>
              </td></tr>
            </table>
            <p style="margin:0 0 20px;color:#ef4444;font-size:13px;font-weight:500;">
              ⚠️ Por seguridad, cambia tu contraseña en el primer inicio de sesión.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#111827;border-radius:8px;padding:0;">
                  <a href="${safeUrl}/inicio" style="display:inline-block;padding:12px 28px;color:#fffb00;text-decoration:none;font-size:14px;font-weight:700;">
                    Ir al panel →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Este mensaje fue enviado por ${safeSaas}. Por favor no respondas a este correo.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this.resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `¡Bienvenido a ${saasName}! Tus credenciales de acceso`,
      html,
    });
  }
}
