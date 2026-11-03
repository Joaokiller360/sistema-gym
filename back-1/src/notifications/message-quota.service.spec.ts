import { MessageQuotaService } from './message-quota.service';

/** In-memory stand-in for the few Prisma calls the quota makes */
function setup(o: {
  limit: number | null;
  used?: number;
  usedFromCredits?: number;
  credits?: number;
  monthly?: number;
  packsEnabled?: boolean;
}) {
  const state = {
    credits: o.credits ?? 0,
    usage: [] as { count: number; fromCredits: number; kind: string }[],
  };
  const db: any = {
    $executeRaw: jest.fn(),
    gym: {
      findUnique: jest.fn(async () => ({
        timezone: 'UTC',
        subscriptionPlan: 'PRO',
        messageCredits: state.credits,
      })),
      update: jest.fn(async ({ data }: any) => {
        state.credits -= data.messageCredits.decrement;
      }),
    },
    subscriptionPlan: {
      findUnique: jest.fn(async () => ({
        monthlyMessageLimit: o.limit,
        messagePacksEnabled: o.packsEnabled ?? true,
      })),
    },
    messagePackPurchase: {
      aggregate: jest.fn(async () => ({ _sum: { messages: o.monthly ?? 0 } })),
    },
    messageUsage: {
      aggregate: jest.fn(async () => ({
        _sum: {
          count: (o.used ?? 0) + state.usage.reduce((a, u) => a + u.count, 0),
          fromCredits:
            (o.usedFromCredits ?? 0) +
            state.usage.reduce((a, u) => a + u.fromCredits, 0),
        },
      })),
      create: jest.fn(async ({ data }: any) => {
        state.usage.push(data);
      }),
    },
  };
  db.$transaction = (cb: any) => cb(db);
  return { svc: new MessageQuotaService(db), state };
}

describe('MessageQuotaService', () => {
  it('uses the plan allowance first', async () => {
    const { svc, state } = setup({ limit: 300, used: 100 });
    const r = await svc.consume('g', 186, 'ANNOUNCEMENT');
    expect(r?.remaining).toBe(14);
    expect(state.usage[0]).toMatchObject({ count: 186, fromCredits: 0 });
  });

  it('refuses when the allowance and credits are not enough', async () => {
    const { svc, state } = setup({ limit: 300, used: 200 });
    expect(await svc.consume('g', 186, 'ANNOUNCEMENT')).toBeNull();
    expect(state.usage).toHaveLength(0);
  });

  it('takes the rest from one-time credits', async () => {
    const { svc, state } = setup({ limit: 300, used: 200, credits: 500 });
    const r = await svc.consume('g', 186, 'ANNOUNCEMENT');
    expect(state.usage[0].fromCredits).toBe(86);
    expect(state.credits).toBe(414);
    expect(r?.remaining).toBe(414);
  });

  it('adds active monthly packs to the allowance', async () => {
    const { svc } = setup({ limit: 100, used: 100, monthly: 1000 });
    expect((await svc.balance('g'))?.remaining).toBe(1000);
  });

  it('does not count credit-paid messages against the allowance', async () => {
    const { svc } = setup({
      limit: 300,
      used: 350,
      usedFromCredits: 50,
      credits: 20,
    });
    // 300 of the 350 came from the allowance: it's used up, only credits remain
    expect((await svc.balance('g'))?.remaining).toBe(20);
  });

  it('lets plans without allowance spend credits', async () => {
    const { svc, state } = setup({ limit: 0, credits: 5 });
    expect(await svc.consume('g', 1, 'BIRTHDAY')).not.toBeNull();
    expect(state.usage[0].fromCredits).toBe(1);
  });

  it('never blocks unlimited plans', async () => {
    const { svc } = setup({ limit: null, used: 1_000_000 });
    expect((await svc.consume('g', 500, 'ANNOUNCEMENT'))?.remaining).toBeNull();
  });

  it('runs the follow-up inside the same transaction', async () => {
    const { svc } = setup({ limit: 300 });
    const r = await svc.consume('g', 1, 'TEST', async () => 'saved');
    expect(r?.result).toBe('saved');
  });
});
