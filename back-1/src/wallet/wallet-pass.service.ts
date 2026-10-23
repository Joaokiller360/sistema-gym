import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePassInput, WalletWalletClient } from './walletwallet.client';

/** Prefix written into the pass QR so reception scanners can tell our codes apart. */
export const WALLET_CODE_PREFIX = 'GYMOS-';

export interface PassMembership {
  endDate: Date;
  visitsTotal: number | null;
  visitsUsed: number;
  plan: { name: string };
}

/** The membership a pass/check-in should reflect: unlimited first, else the visit plan ending soonest. */
export function pickMembership<T extends PassMembership>(memberships: T[]): T | null {
  const unlimited = memberships.find((m) => m.visitsTotal == null);
  if (unlimited) return unlimited;
  return (
    [...memberships]
      .filter((m) => m.visitsUsed < (m.visitsTotal ?? 0))
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime())[0] ?? null
  );
}

export function visitsRemaining(m: Pick<PassMembership, 'visitsTotal' | 'visitsUsed'>) {
  return m.visitsTotal == null ? null : Math.max(0, m.visitsTotal - m.visitsUsed);
}

@Injectable()
export class WalletPassService {
  private readonly logger = new Logger(WalletPassService.name);

  constructor(
    private readonly prisma: PrismaService,
    readonly client: WalletWalletClient,
  ) {}

  /** Active, non-expired memberships of a member (with what the pass needs). */
  activeMemberships(gymId: string, memberId: string) {
    return this.prisma.membership.findMany({
      where: { gymId, memberId, status: 'ACTIVE', endDate: { gte: new Date() } },
      orderBy: { endDate: 'desc' },
      include: { plan: { select: { name: true } } },
    });
  }

  buildPass(opts: {
    token: string;
    fullName: string;
    gymName: string;
    timezone: string;
    membership: PassMembership | null;
  }): CreatePassInput {
    const { membership } = opts;
    const remaining = membership ? visitsRemaining(membership) : null;
    const endDate = membership
      ? membership.endDate.toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: opts.timezone,
        })
      : null;

    const secondaryFields: CreatePassInput['secondaryFields'] = [
      { label: 'Plan', value: membership?.plan.name ?? 'Sin plan activo' },
    ];
    if (remaining != null)
      secondaryFields.push({
        label: 'Días restantes',
        value: `${remaining} de ${membership!.visitsTotal}`,
        changeMessage: 'Te quedan %@ días en tu plan',
      });
    if (endDate) secondaryFields.push({ label: 'Vence', value: endDate });

    return {
      barcodeValue: `${WALLET_CODE_PREFIX}${opts.token}`,
      barcodeFormat: 'QR',
      barcodeAltText: opts.fullName,
      logoText: opts.gymName,
      organizationName: opts.gymName,
      description: `Credencial de socio — ${opts.gymName}`,
      primaryFields: [{ label: 'Socio', value: opts.fullName }],
      secondaryFields,
      backFields: [
        {
          label: 'Cómo usarlo',
          value:
            remaining != null
              ? 'Mostrá este código en recepción para registrar tu asistencia y tus compras. Cada día que entrenás descuenta un día de tu plan.'
              : 'Mostrá este código en recepción para registrar tu asistencia y tus compras.',
        },
      ],
      colorPreset: 'dark',
      sharingProhibited: true,
    };
  }

  /**
   * Pushes the member's current plan / remaining days to their issued pass.
   * Best-effort: never throws, does nothing if the member has no pass.
   */
  async sync(gymId: string, memberId: string): Promise<void> {
    if (!this.client.isConfigured) return;
    try {
      const member = await this.prisma.member.findFirst({
        where: { id: memberId, gymId },
        select: {
          firstName: true,
          lastName: true,
          walletToken: true,
          walletSerial: true,
          gym: { select: { name: true, timezone: true } },
        },
      });
      if (!member?.walletSerial || !member.walletToken) return;

      const membership = pickMembership(await this.activeMemberships(gymId, memberId));
      await this.client.updatePass(
        member.walletSerial,
        this.buildPass({
          token: member.walletToken,
          fullName: `${member.firstName} ${member.lastName}`.trim(),
          gymName: member.gym.name,
          timezone: member.gym.timezone ?? 'UTC',
          membership,
        }),
      );
    } catch (e) {
      this.logger.warn(`sync pass for member ${memberId} failed: ${(e as Error).message}`);
    }
  }
}
