import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { StoreService } from '../store/store.service';
import { startOfDayUTC, endOfDayUTC } from '../common/utils/timezone.util';
import { WalletWalletClient } from './walletwallet.client';
import {
  WALLET_CODE_PREFIX,
  WalletPassService,
  pickMembership,
  visitsRemaining,
} from './wallet-pass.service';

export { WALLET_CODE_PREFIX };

const TOKEN_RE = /^[a-f0-9]{32}$/;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}

/** Accepts the raw scanned text ("GYMOS-<token>" or the bare token) and returns the token. */
export function parseWalletCode(code: string): string {
  const raw = (code ?? '').trim();
  const token = raw.toUpperCase().startsWith(WALLET_CODE_PREFIX)
    ? raw.slice(WALLET_CODE_PREFIX.length)
    : raw;
  const normalized = token.toLowerCase();
  if (!TOKEN_RE.test(normalized))
    throw new BadRequestException('Código QR no reconocido');
  return normalized;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: WalletWalletClient,
    private readonly passes: WalletPassService,
    private readonly attendance: AttendanceService,
    private readonly store: StoreService,
  ) {}

  // ── Pass lifecycle ────────────────────────────────────────

  async getPass(gymId: string, memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
      select: {
        walletSerial: true,
        walletShareUrl: true,
        walletGoogleUrl: true,
        walletIssuedAt: true,
      },
    });
    if (!member)
      throw new NotFoundException('Miembro no encontrado en este gimnasio');
    return {
      configured: this.client.isConfigured,
      issued: !!member.walletSerial,
      shareUrl: member.walletShareUrl,
      googleSaveUrl: member.walletGoogleUrl,
      issuedAt: member.walletIssuedAt,
    };
  }

  /** Issues a new pass (revoking any previous one, so old QR codes stop working). */
  async issuePass(
    gymId: string,
    memberId: string,
    opts: { sendEmail?: boolean } = {},
  ) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
      include: { gym: { select: { name: true, timezone: true } } },
    });
    if (!member)
      throw new NotFoundException('Miembro no encontrado en este gimnasio');

    const membership = pickMembership(
      await this.passes.activeMemberships(gymId, memberId),
    );

    const token = randomBytes(16).toString('hex');
    const fullName = `${member.firstName} ${member.lastName}`.trim();

    const pass = await this.client.createPass(
      this.passes.buildPass({
        token,
        fullName,
        gymName: member.gym.name,
        timezone: member.gym.timezone ?? 'UTC',
        membership,
      }),
    );

    const previousSerial = member.walletSerial;

    await this.prisma.member.update({
      where: { id: member.id },
      data: {
        walletToken: token,
        walletSerial: pass.serialNumber,
        walletShareUrl: pass.shareUrl,
        walletGoogleUrl: pass.googleSaveUrl,
        walletIssuedAt: new Date(),
      },
    });

    if (previousSerial) await this.client.revokePass(previousSerial);

    let emailSent = false;
    if (opts.sendEmail)
      emailSent = await this.sendPassEmail(
        member.email,
        member.firstName,
        member.gym.name,
        pass.shareUrl,
      );

    return {
      issued: true,
      shareUrl: pass.shareUrl,
      googleSaveUrl: pass.googleSaveUrl,
      emailSent,
    };
  }

  async revokePass(gymId: string, memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
      select: { id: true, walletSerial: true },
    });
    if (!member)
      throw new NotFoundException('Miembro no encontrado en este gimnasio');
    if (member.walletSerial) await this.client.revokePass(member.walletSerial);
    await this.prisma.member.update({
      where: { id: member.id },
      data: {
        walletToken: null,
        walletSerial: null,
        walletShareUrl: null,
        walletGoogleUrl: null,
        walletIssuedAt: null,
      },
    });
    return { issued: false };
  }

  async emailPass(gymId: string, memberId: string) {
    const member = await this.prisma.member.findFirst({
      where: { id: memberId, gymId },
      include: { gym: { select: { name: true } } },
    });
    if (!member)
      throw new NotFoundException('Miembro no encontrado en este gimnasio');
    if (!member.walletShareUrl)
      throw new ConflictException('El miembro todavía no tiene pase de Wallet');
    const emailSent = await this.sendPassEmail(
      member.email,
      member.firstName,
      member.gym.name,
      member.walletShareUrl,
    );
    return { emailSent };
  }

  private async sendPassEmail(
    to: string,
    firstName: string,
    gymName: string,
    shareUrl: string,
  ) {
    try {
      const { error } = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@tudominio.com',
        to,
        subject: `Tu credencial de ${gymName} para el Wallet`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
            <h2 style="margin:0 0 12px">Hola ${escapeHtml(firstName)} 👋</h2>
            <p style="line-height:1.5">Tu credencial de <strong>${escapeHtml(gymName)}</strong> ya está lista. Agregala a Apple Wallet o Google Wallet y mostrá el código QR en recepción para registrar tu asistencia.</p>
            <p style="margin:28px 0"><a href="${escapeHtml(shareUrl)}" style="background:#111;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Agregar a mi Wallet</a></p>
            <p style="font-size:12px;color:#666">Si el botón no funciona, abrí este enlace: ${escapeHtml(shareUrl)}</p>
          </div>`,
      });
      if (error) {
        this.logger.warn(`Wallet pass email to ${to} failed: ${error.message}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(
        `Wallet pass email to ${to} failed: ${(e as Error).message}`,
      );
      return false;
    }
  }

  // ── Reception scan ────────────────────────────────────────

  private async memberFromCode(gymId: string, code: string) {
    const token = parseWalletCode(code);
    const member = await this.prisma.member.findFirst({
      where: { walletToken: token, gymId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        isActive: true,
      },
    });
    if (!member)
      throw new NotFoundException(
        'El código no corresponde a ningún socio de este gimnasio',
      );
    return member;
  }

  async scan(gymId: string, code: string) {
    const member = await this.memberFromCode(gymId, code);
    const now = new Date();

    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: { timezone: true, currency: true },
    });
    const tz = gym?.timezone ?? 'UTC';
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz });

    const [memberships, todayAttendance, pendingCredits] = await Promise.all([
      this.passes.activeMemberships(gymId, member.id),
      this.prisma.attendance.findFirst({
        where: {
          gymId,
          memberId: member.id,
          checkIn: {
            gte: startOfDayUTC(todayStr, tz),
            lte: endOfDayUTC(todayStr, tz),
          },
        },
        orderBy: { checkIn: 'desc' },
        select: { checkIn: true },
      }),
      this.prisma.memberProductCredit.findMany({
        where: { gymId, memberId: member.id, isPaid: false },
        select: { quantity: true, unitPrice: true },
      }),
    ]);

    // Defensive: an ACTIVE visit plan with no days left counts as inactive
    const membership = pickMembership(memberships);
    const exhausted = !membership && memberships.length > 0 ? memberships[0] : null;

    return {
      member,
      membership: membership
        ? {
            active: true,
            planName: membership.plan.name,
            endDate: membership.endDate,
            visitsTotal: membership.visitsTotal,
            visitsRemaining: visitsRemaining(membership),
          }
        : {
            active: false,
            planName: exhausted?.plan.name ?? null,
            endDate: null,
            visitsTotal: exhausted?.visitsTotal ?? null,
            visitsRemaining: exhausted ? 0 : null,
          },
      checkedInToday: todayAttendance?.checkIn ?? null,
      pendingCredits: {
        count: pendingCredits.length,
        total: pendingCredits.reduce(
          (sum, c) => sum + c.quantity * c.unitPrice,
          0,
        ),
        currency: gym?.currency ?? 'ARS',
      },
    };
  }

  async checkIn(gymId: string, code: string) {
    const member = await this.memberFromCode(gymId, code);
    return this.attendance.checkIn(gymId, member.id);
  }

  async sale(
    gymId: string,
    code: string,
    data: {
      items: { productId: string; quantity: number }[];
      method: string;
      notes?: string;
    },
  ) {
    const member = await this.memberFromCode(gymId, code);
    return this.store.createSale(gymId, { ...data, memberId: member.id });
  }

  async credit(
    gymId: string,
    code: string,
    data: { items: { productId: string; quantity: number }[]; notes?: string },
  ) {
    const member = await this.memberFromCode(gymId, code);
    return this.store.assignCredits(gymId, { ...data, memberId: member.id });
  }
}
