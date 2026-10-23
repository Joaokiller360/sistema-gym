import { pickMembership, visitsRemaining } from './wallet-pass.service';

const m = (endDate: string, visitsTotal: number | null, visitsUsed = 0, name = 'P') => ({
  endDate: new Date(endDate),
  visitsTotal,
  visitsUsed,
  plan: { name },
});

describe('pickMembership', () => {
  it('returns null when there are no memberships', () => {
    expect(pickMembership([])).toBeNull();
  });

  it('prefers an unlimited plan over visit plans', () => {
    const unlimited = m('2026-11-01', null);
    expect(pickMembership([m('2026-10-30', 10, 2), unlimited])).toBe(unlimited);
  });

  it('picks the visit plan ending soonest that still has days', () => {
    const soon = m('2026-10-30', 8, 3);
    expect(pickMembership([m('2026-12-01', 12), soon, m('2026-10-25', 4, 4)])).toBe(soon);
  });

  it('returns null when every visit plan is used up', () => {
    expect(pickMembership([m('2026-12-01', 12, 12)])).toBeNull();
  });
});

describe('visitsRemaining', () => {
  it('is null for unlimited plans', () => {
    expect(visitsRemaining({ visitsTotal: null, visitsUsed: 5 })).toBeNull();
  });

  it('never goes below zero', () => {
    expect(visitsRemaining({ visitsTotal: 8, visitsUsed: 3 })).toBe(5);
    expect(visitsRemaining({ visitsTotal: 8, visitsUsed: 9 })).toBe(0);
  });
});
