import { memberWhatsapp } from './member-phone.util';
import { gymIdForPhone } from './whatsapp.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('memberWhatsapp', () => {
  it.each([
    ['+593 98 666 0737', 'EC', '593986660737'],
    ['0986660737', 'EC', '593986660737'],
    ['98 666 0737', 'EC', '593986660737'],
    ['593986660737', 'EC', '593986660737'],
    ['(212) 555-1234', 'US', '12125551234'],
    ['11 2345-6789', 'AR', '5491123456789'],
  ])('%s (%s) → %s', (raw, country, expected) => {
    expect(memberWhatsapp(raw, country)).toBe(expected);
  });

  it('rejects numbers it cannot dial', () => {
    expect(memberWhatsapp('123', 'EC')).toBeNull();
    expect(memberWhatsapp('0986660737', null)).toBeNull();
    expect(memberWhatsapp('', 'EC')).toBeNull();
  });
});

describe('gymIdForPhone', () => {
  const prisma = (ids: string[]) =>
    ({
      gym: { findMany: jest.fn().mockResolvedValue(ids.map((id) => ({ id }))) },
    }) as unknown as PrismaService;

  it('links the only gym that has the number', async () => {
    await expect(gymIdForPhone(prisma(['g1']), '593986660737')).resolves.toBe(
      'g1',
    );
  });

  it('links nothing when several gyms claim the same number', async () => {
    await expect(
      gymIdForPhone(prisma(['g1', 'g2']), '593986660737'),
    ).resolves.toBeUndefined();
  });

  it('links nothing when no gym has it', async () => {
    await expect(
      gymIdForPhone(prisma([]), '593986660737'),
    ).resolves.toBeUndefined();
  });
});
