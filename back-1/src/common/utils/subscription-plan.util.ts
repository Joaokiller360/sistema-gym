import { PrismaService } from '../../prisma/prisma.service';

/** Loads a gym together with the SubscriptionPlan its `subscriptionPlan` key points to. */
export async function getGymPlan(prisma: PrismaService, gymId: string) {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: {
      id: true,
      name: true,
      timezone: true,
      country: true,
      subscriptionPlan: true,
      whatsappPhone: true,
    },
  });
  if (!gym) return { gym: null, plan: null };
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { key: gym.subscriptionPlan },
  });
  return { gym, plan };
}

/** Map planKey → plan flags, for crons that iterate over many gyms. */
export async function getPlanFlagsByKey(prisma: PrismaService) {
  const plans = await prisma.subscriptionPlan.findMany({
    select: {
      key: true,
      birthdayMessagesEnabled: true,
      expiryRemindersEnabled: true,
    },
  });
  return new Map(plans.map((p) => [p.key, p]));
}
