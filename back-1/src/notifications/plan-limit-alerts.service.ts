import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { TEMPLATES } from './whatsapp-templates';

/** Usage percentages that trigger an alert, ascending. 100 = limit reached. */
const THRESHOLDS = [80, 90, 100] as const;

/**
 * Tells gym owners over WhatsApp when their members are close to (or at) the
 * SaaS plan's maxMembers. Each threshold is sent once; Gym.memberLimitAlertLevel
 * remembers the last one and drops again when usage goes down or the plan grows.
 */
@Injectable()
export class PlanLimitAlertsService {
  private readonly logger = new Logger(PlanLimitAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  /** Fire-and-forget safe: logs instead of throwing. */
  async checkMemberLimit(gymId: string) {
    try {
      await this.evaluate(gymId);
    } catch (e) {
      this.logger.error(`[PlanLimit] Check failed for gym ${gymId}:`, e);
    }
  }

  // Catches plan changes and deletions that don't go through member creation
  @Cron('0 14 * * *')
  async checkAllGyms() {
    const gyms = await this.prisma.gym.findMany({
      where: {
        isActive: true,
        OR: [
          { whatsappPhone: { not: null } },
          { memberLimitAlertLevel: { gt: 0 } },
        ],
      },
      select: { id: true },
    });
    for (const g of gyms) await this.checkMemberLimit(g.id);
  }

  private async evaluate(gymId: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        name: true,
        isActive: true,
        subscriptionPlan: true,
        whatsappPhone: true,
        memberLimitAlertLevel: true,
        owner: { select: { name: true } },
      },
    });
    if (!gym?.isActive) return;

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { key: gym.subscriptionPlan },
      select: { label: true, maxMembers: true },
    });
    const max = plan?.maxMembers;
    const used = max ? await this.prisma.member.count({ where: { gymId } }) : 0;
    const pct = max ? Math.floor((used / max) * 100) : 0;
    const level = [...THRESHOLDS].reverse().find((t) => pct >= t) ?? 0;

    if (level === gym.memberLimitAlertLevel) return;
    if (level < gym.memberLimitAlertLevel) {
      // Usage went down (or plan is unlimited now): re-arm the lower thresholds
      await this.setLevel(gymId, level);
      return;
    }
    if (!gym.whatsappPhone || !max || !plan) return;

    // Paused from the CRM: keep the level as is so the alert goes out once resumed
    const settings = await this.prisma.platformSettings.findFirst({
      select: { whatsappAlertsPaused: true },
    });
    if (settings?.whatsappAlertsPaused) {
      this.logger.log(`[PlanLimit] Alerts paused, held back for gym ${gymId}`);
      return;
    }

    const owner = gym.owner?.name.split(' ')[0] || gym.name;
    const sent =
      level === 100
        ? await this.whatsapp.sendTemplate(
            gym.whatsappPhone,
            TEMPLATES.limitReached,
            [owner, gym.name, max, plan.label],
          )
        : await this.whatsapp.sendTemplate(
            gym.whatsappPhone,
            TEMPLATES.limitWarning,
            [owner, gym.name, pct, used, max, plan.label],
          );

    // Not advancing on failure lets the daily cron retry
    if (sent) {
      await this.setLevel(gymId, level);
      this.logger.log(
        `[PlanLimit] Gym ${gymId} alerted at ${level}% (${used}/${max})`,
      );
    }
  }

  private setLevel(gymId: string, level: number) {
    return this.prisma.gym.update({
      where: { id: gymId },
      data: { memberLimitAlertLevel: level },
    });
  }
}
