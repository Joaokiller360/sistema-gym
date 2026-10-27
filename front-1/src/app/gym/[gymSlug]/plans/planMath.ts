import type { Plan } from '@/types'
import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from '@/i18n/config'
import { plansMessages } from './messages'

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

export function durationLabel(days: number, locale: Locale = DEFAULT_LOCALE) {
  const t = plansMessages[locale].math
  return t.durations[days] ?? t.days(days)
}

export function accessLabel(p: PlanShape, locale: Locale = DEFAULT_LOCALE) {
  const t = plansMessages[locale].math
  if (p.visitLimit != null) return t.days(p.visitLimit)
  if (p.daysPerWeek == null) return t.unlimited
  return p.daysPerWeek === 7 ? t.daily : t.perWeek(p.daysPerWeek)
}

export function peopleLabel(maxMembers: number, locale: Locale = DEFAULT_LOCALE) {
  const t = plansMessages[locale].math
  return maxMembers > 1 ? t.forPeople(maxMembers) : t.individual
}

export function money(value: number, currency: string, decimals = 0, locale: Locale = DEFAULT_LOCALE) {
  return value.toLocaleString(INTL_LOCALE[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
