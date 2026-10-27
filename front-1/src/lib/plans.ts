import type { Plan } from '@/types'
import { DEFAULT_LOCALE, defineMessages, type Locale } from '@/i18n/config'

const summaryMessages = defineMessages({
  es: {
    visits: (visits: number, duration: number) => `${visits} días de entreno · vigencia ${duration} días`,
    time: (duration: number, perWeek: number | null) => `${duration} días${perWeek ? ` · ${perWeek}x/sem` : ''}`,
  },
  en: {
    visits: (visits: number, duration: number) => `${visits} training days · valid ${duration} days`,
    time: (duration: number, perWeek: number | null) => `${duration} days${perWeek ? ` · ${perWeek}x/wk` : ''}`,
  },
})

/** One-line description of a plan's access: "12 días de entreno · vigencia 30 días" or "30 días · 3x/sem". */
export function planAccessSummary(
  plan: Pick<Plan, 'durationDays' | 'daysPerWeek' | 'visitLimit'>,
  periods = 1,
  locale: Locale = DEFAULT_LOCALE,
) {
  const t = summaryMessages[locale]
  const duration = plan.durationDays * periods
  if (plan.visitLimit != null) return t.visits(plan.visitLimit * periods, duration)
  return t.time(duration, plan.daysPerWeek)
}
