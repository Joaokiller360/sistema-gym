import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { startOfDayUTC } from '../common/utils/timezone.util';

export type MessageKind = 'ANNOUNCEMENT' | 'BIRTHDAY' | 'EXPIRY' | 'TEST';

type Tx = Prisma.TransactionClient;

/** Calendar month in the gym's timezone: the quota resets on the 1st */
export function monthWindow(timezone: string, now = new Date()) {
  const local = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
  const [y, m] = local.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = startOfDayUTC(`${y}-${pad(m)}-01`, timezone);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const resetsAt = startOfDayUTC(`${nextY}-${pad(nextM)}-01`, timezone);
  return { start, resetsAt };
}

/**
 * Monthly WhatsApp allowance of a gym: the plan's limit plus active monthly packs, then
 * one-time pack credits. Every message to a member (announcements, birthdays, expiry
 * reminders, tests) goes through `consume`, so the platform never pays for more than it sold.
 */
@Injectable()
export class MessageQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  private async load(db: Tx | PrismaService, gymId: string) {
    const gym = await db.gym.findUnique({
      where: { id: gymId },
      select: { timezone: true, subscriptionPlan: true, messageCredits: true },
    });
    if (!gym) return null;
    const { start, resetsAt } = monthWindow(gym.timezone ?? 'UTC');
    const [plan, monthly, usage] = await Promise.all([
      db.subscriptionPlan.findUnique({
        where: { key: gym.subscriptionPlan },
        select: { monthlyMessageLimit: true, messagePacksEnabled: true },
      }),
      db.messagePackPurchase.aggregate({
        where: { gymId, status: 'ACTIVE', billing: 'MONTHLY' },
        _sum: { messages: true },
      }),
      db.messageUsage.aggregate({
        where: { gymId, createdAt: { gte: start } },
        _sum: { count: true, fromCredits: true },
      }),
    ]);
    // No plan row → no allowance (safe default)
    const planLimit = plan ? plan.monthlyMessageLimit : 0;
    const monthlyExtra = monthly._sum.messages ?? 0;
    // Messages paid with credits don't eat into the monthly allowance
    const used = usage._sum.count ?? 0;
    const usedFromAllowance = used - (usage._sum.fromCredits ?? 0);
    const allowance = planLimit === null ? null : planLimit + monthlyExtra;
    const allowanceLeft =
      allowance === null ? null : Math.max(0, allowance - usedFromAllowance);
    return {
      planLimit,
      monthlyExtra,
      allowance,
      used,
      credits: gym.messageCredits,
      remaining:
        allowanceLeft === null ? null : allowanceLeft + gym.messageCredits,
      allowanceLeft,
      resetsAt,
      packsEnabled: plan?.messagePacksEnabled ?? false,
    };
  }

  async balance(gymId: string) {
    return this.load(this.prisma, gymId);
  }

  /**
   * Records `count` messages if the gym has room for all of them, and runs `then` in the
   * same transaction (e.g. to save the announcement). Serialized per gym, so two sends
   * can't both pass the check. Returns null when there isn't enough balance.
   */
  async consume<T = void>(
    gymId: string,
    count: number,
    kind: MessageKind,
    then?: (tx: Tx) => Promise<T>,
  ): Promise<{ result: T | undefined; remaining: number | null } | null> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'quota:' + gymId}))`;
      const b = await this.load(tx, gymId);
      if (
        !b ||
        b.remaining === 0 ||
        (b.remaining !== null && count > b.remaining)
      ) {
        return null;
      }
      const fromCredits =
        b.allowanceLeft === null ? 0 : Math.max(0, count - b.allowanceLeft);
      if (fromCredits > 0) {
        await tx.gym.update({
          where: { id: gymId },
          data: { messageCredits: { decrement: fromCredits } },
        });
      }
      await tx.messageUsage.create({
        data: { gymId, kind, count, fromCredits },
      });
      const result = then ? await then(tx) : undefined;
      return {
        result,
        remaining: b.remaining === null ? null : b.remaining - count,
      };
    });
  }
}
