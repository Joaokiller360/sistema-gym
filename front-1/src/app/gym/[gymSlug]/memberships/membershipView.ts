import type { MembershipStatus, MembershipWithRelations } from '@/types'

export type FilterKey = 'all' | 'expiring' | MembershipStatus

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ACTIVE', label: 'Activas' },
  { key: 'expiring', label: 'Por vencer' },
  { key: 'EXPIRED', label: 'Vencidas' },
  { key: 'FROZEN', label: 'Congeladas' },
  { key: 'SUSPENDED', label: 'Suspendidas' },
  { key: 'CANCELLED', label: 'Canceladas' },
  { key: 'all', label: 'Todas' },
]

const DAY_MS = 86_400_000
const LOW_DAYS = 3
const LOW_VISITS = 2

export interface MembershipView {
  /** Visit-limited plan (consumes one day per gym day attended) */
  byVisits: boolean
  visitsLeft: number | null
  daysLeft: number
  /** Active and about to run out (time or visits) */
  expiring: boolean
  remainingLabel: string
  kindLabel: string
  /** 0..1 share of the plan still available */
  pct: number
  barClass: string
}

export function membershipView(m: MembershipWithRelations, now: number): MembershipView {
  const daysLeft = Math.ceil((new Date(m.endDate).getTime() - now) / DAY_MS)
  const byVisits = m.visitsTotal != null
  const visitsLeft = byVisits ? Math.max(0, m.visitsTotal! - m.visitsUsed) : null
  const active = m.status === 'ACTIVE'

  const expiring = active && (daysLeft <= LOW_DAYS || (visitsLeft != null && visitsLeft <= LOW_VISITS))

  let pct: number
  let remainingLabel: string
  if (byVisits) {
    pct = m.visitsTotal! > 0 ? visitsLeft! / m.visitsTotal! : 0
    remainingLabel = `Quedan ${visitsLeft} de ${m.visitsTotal} ${m.visitsTotal === 1 ? 'día' : 'días'}`
  } else {
    const duration = Math.max(1, m.plan.durationDays)
    pct = Math.max(0, Math.min(1, daysLeft / duration))
    remainingLabel = daysLeft > 0 ? `Vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}` : 'Sin días restantes'
  }
  if (!active) pct = m.status === 'FROZEN' ? pct : 0

  const empty = byVisits ? visitsLeft === 0 : daysLeft <= 0
  const barClass = empty || !active ? 'bg-zinc-300' : expiring ? 'bg-amber-500' : 'bg-[#1fad9d]'

  return {
    byVisits,
    visitsLeft,
    daysLeft,
    expiring,
    remainingLabel,
    kindLabel: byVisits ? `Plan por días · vence ${fmtShort(m.endDate)}` : `${m.plan.durationDays} días corridos`,
    pct,
    barClass,
  }
}

export function matchesFilter(m: MembershipWithRelations, v: MembershipView, key: FilterKey) {
  if (key === 'all') return true
  if (key === 'expiring') return v.expiring
  return m.status === key
}

export function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export function fmtLong(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}
