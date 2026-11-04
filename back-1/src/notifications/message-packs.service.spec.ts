import { MessagePacksService } from './message-packs.service';

/** One purchase and its gym, enough for voiding and deleting sales */
function setup(
  p: { status: string; billing: string; messages: number },
  credits: number,
) {
  const state = {
    credits,
    purchase: { id: 'p', gymId: 'g', ...p } as any,
    deleted: false,
  };
  const db: any = {
    $executeRaw: jest.fn(),
    gym: {
      findUniqueOrThrow: jest.fn(async () => ({
        messageCredits: state.credits,
      })),
      update: jest.fn(async ({ data }: any) => {
        state.credits -= data.messageCredits.decrement;
      }),
    },
    messagePackPurchase: {
      findUnique: jest.fn(async () => (state.deleted ? null : state.purchase)),
      findUniqueOrThrow: jest.fn(async () => state.purchase),
      update: jest.fn(async ({ data }: any) =>
        Object.assign(state.purchase, data),
      ),
      delete: jest.fn(async () => {
        state.deleted = true;
      }),
    },
  };
  db.$transaction = (cb: any) => cb(db);
  return { svc: new MessagePacksService(db), state, db };
}

describe('MessagePacksService sales', () => {
  it('voiding a one-time pack takes back its credits', async () => {
    const { svc, state } = setup(
      { status: 'ACTIVE', billing: 'ONCE', messages: 500 },
      700,
    );
    expect(await svc.cancel('p')).toEqual({ ok: true, removedCredits: 500 });
    expect(state.credits).toBe(200);
    expect(state.purchase.status).toBe('CANCELLED');
  });

  it('only takes back the credits still unused', async () => {
    const { svc, state } = setup(
      { status: 'ACTIVE', billing: 'ONCE', messages: 500 },
      120,
    );
    expect((await svc.cancel('p')).removedCredits).toBe(120);
    expect(state.credits).toBe(0);
  });

  it('voiding a monthly pack leaves credits alone', async () => {
    const { svc, state } = setup(
      { status: 'ACTIVE', billing: 'MONTHLY', messages: 300 },
      50,
    );
    expect((await svc.cancel('p')).removedCredits).toBe(0);
    expect(state.credits).toBe(50);
    expect(state.purchase.status).toBe('CANCELLED');
  });

  it('voiding a pending request rejects it', async () => {
    const { svc, state } = setup(
      { status: 'PENDING', billing: 'ONCE', messages: 500 },
      0,
    );
    await svc.cancel('p');
    expect(state.purchase.status).toBe('REJECTED');
  });

  it('refuses to void twice', async () => {
    const { svc } = setup(
      { status: 'CANCELLED', billing: 'ONCE', messages: 500 },
      0,
    );
    await expect(svc.cancel('p')).rejects.toThrow('ya está anulada');
  });

  it('deleting an active one-time sale removes its credits too', async () => {
    const { svc, state } = setup(
      { status: 'ACTIVE', billing: 'ONCE', messages: 500 },
      900,
    );
    expect(await svc.deletePurchase('p')).toEqual({
      ok: true,
      removedCredits: 500,
    });
    expect(state.credits).toBe(400);
    expect(state.deleted).toBe(true);
  });

  it('deleting a voided sale does not touch credits', async () => {
    const { svc, state, db } = setup(
      { status: 'CANCELLED', billing: 'ONCE', messages: 500 },
      900,
    );
    await svc.deletePurchase('p');
    expect(state.credits).toBe(900);
    expect(db.gym.update).not.toHaveBeenCalled();
  });

  it('locks the gym quota before touching credits', async () => {
    const { svc, db } = setup(
      { status: 'ACTIVE', billing: 'ONCE', messages: 1 },
      1,
    );
    await svc.cancel('p');
    expect(db.$executeRaw).toHaveBeenCalled();
  });
});
