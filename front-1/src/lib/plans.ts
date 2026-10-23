import type { Plan } from '@/types'

/** One-line description of a plan's access: "12 días de entreno · vigencia 30 días" or "30 días · 3x/sem". */
export function planAccessSummary(plan: Pick<Plan, 'durationDays' | 'daysPerWeek' | 'visitLimit'>, periods = 1) {
  const duration = plan.durationDays * periods
  if (plan.visitLimit != null) return `${plan.visitLimit * periods} días de entreno · vigencia ${duration} días`
  return `${duration} días${plan.daysPerWeek ? ` · ${plan.daysPerWeek}x/sem` : ''}`
}
