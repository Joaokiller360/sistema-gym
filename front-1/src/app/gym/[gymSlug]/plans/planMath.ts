import type { Plan } from '@/types'

// Row swatch per plan position; paused plans go grey
export const PLAN_COLORS = ['#2cc4b2', '#38bdf8', '#fbbf24', '#a78bfa', '#f472b6', '#fb923c']
export const PAUSED_COLOR = '#6b726f'

type PlanShape = Pick<Plan, 'durationDays' | 'daysPerWeek' | 'visitLimit'>

/** Days a member can actually train within the plan. */
export function trainableDays(p: PlanShape) {
  if (p.visitLimit != null) return p.visitLimit
  if (p.daysPerWeek != null) return Math.max(1, Math.round((p.daysPerWeek * p.durationDays) / 7))
  return p.durationDays
}

export function pricePerDay(p: PlanShape & Pick<Plan, 'price'>) {
  return p.price / trainableDays(p)
}

export function durationLabel(days: number) {
  const named: Record<number, string> = { 30: '1 mes', 60: '2 meses', 90: '3 meses', 180: '6 meses', 365: '1 año' }
  return named[days] ?? `${days} días`
}

export function accessLabel(p: PlanShape) {
  if (p.visitLimit != null) return `${p.visitLimit} días`
  if (p.daysPerWeek == null) return 'Ilimitado'
  return p.daysPerWeek === 7 ? 'Diario' : `${p.daysPerWeek}×/sem`
}

export function peopleLabel(maxMembers: number) {
  return maxMembers > 1 ? `Para ${maxMembers}` : 'Individual'
}

export function money(value: number, currency: string, decimals = 0) {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
