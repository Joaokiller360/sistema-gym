import { describe, expect, it } from 'vitest'
import { memberView, fmtLastVisit, type MemberRow } from './memberStatus'

const NOW = new Date('2026-10-22T15:00:00')
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString()

function row(over: Partial<MemberRow> = {}): MemberRow {
  return {
    id: 'm', firstName: 'Ana', lastName: 'Paz', email: 'a@x.com', phone: null, birthDate: null, photoUrl: null,
    isActive: true, gymId: 'g', branchId: null, createdAt: days(-100), updatedAt: days(-1),
    memberships: [], attendances: [], ...over,
  }
}
const plan = (visitLimit: number | null = null) => ({ id: 'p', name: 'Plan', durationDays: 30, visitLimit })

describe('memberView', () => {
  it('inactive member wins over any plan', () => {
    const v = memberView(row({ isActive: false, memberships: [{ status: 'ACTIVE', endDate: days(10), visitsTotal: null, visitsUsed: 0, plan: plan() }] }), NOW)
    expect(v.key).toBe('inactivo')
  })

  it('no membership → sin plan', () => {
    expect(memberView(row(), NOW).key).toBe('sinplan')
  })

  it('time plan with plenty of days is active, with ≤3 days needs attention', () => {
    const m = (end: number) => row({ memberships: [{ status: 'ACTIVE', endDate: days(end), visitsTotal: null, visitsUsed: 0, plan: plan() }] })
    expect(memberView(m(15), NOW)).toMatchObject({ key: 'activo', remainingLabel: '15 días' })
    expect(memberView(m(2), NOW)).toMatchObject({ key: 'atencion', label: 'Por vencer' })
  })

  it('ACTIVE membership past its end date counts as expired', () => {
    const v = memberView(row({ memberships: [{ status: 'ACTIVE', endDate: days(-2), visitsTotal: null, visitsUsed: 0, plan: plan() }] }), NOW)
    expect(v).toMatchObject({ key: 'vencido', label: 'Vencido' })
  })

  it('visit plan shows remaining days and flags the last two', () => {
    const m = (used: number) => row({ memberships: [{ status: 'ACTIVE', endDate: days(20), visitsTotal: 12, visitsUsed: used, plan: plan(12) }] })
    expect(memberView(m(4), NOW)).toMatchObject({ key: 'activo', remainingLabel: '8 de 12 días', bigNumber: '8' })
    expect(memberView(m(10), NOW).key).toBe('atencion')
  })

  it('used-up visit plan (EXPIRED) is shown as "Sin días"', () => {
    const v = memberView(row({ memberships: [{ status: 'EXPIRED', endDate: days(10), visitsTotal: 8, visitsUsed: 8, plan: plan(8) }] }), NOW)
    expect(v).toMatchObject({ key: 'vencido', remainingLabel: 'Sin días' })
  })

  it('prefers a current membership over a newer-ending cancelled one', () => {
    const v = memberView(row({ memberships: [
      { status: 'CANCELLED', endDate: days(40), visitsTotal: null, visitsUsed: 0, plan: { ...plan(), name: 'Viejo' } },
      { status: 'ACTIVE', endDate: days(20), visitsTotal: null, visitsUsed: 0, plan: { ...plan(), name: 'Actual' } },
    ] }), NOW)
    expect(v).toMatchObject({ key: 'activo', planName: 'Actual' })
  })
})

describe('fmtLastVisit', () => {
  it('formats relative days', () => {
    expect(fmtLastVisit(null, NOW)).toBe('Nunca')
    expect(fmtLastVisit(new Date('2026-10-22T07:02:00').toISOString(), NOW)).toMatch(/^Hoy /)
    expect(fmtLastVisit(new Date('2026-10-21T19:00:00').toISOString(), NOW)).toBe('Ayer')
    expect(fmtLastVisit(new Date('2026-10-16T10:00:00').toISOString(), NOW)).toBe('Hace 6 días')
  })
})
