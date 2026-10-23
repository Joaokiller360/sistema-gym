import { apiFetch } from '@/lib/api'
import { normalizeLogoUrl } from '@/lib/utils'
import type { Gym } from '@/types'

export interface BillingRecord {
  id: string
  amount: string
  currency: string
  method?: string
  notes?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  createdAt: string
}

export interface SubscriptionInfo {
  subscriptionPlan: string
  subscriptionStatus: 'ACTIVE' | 'GRACE' | 'SUSPENDED'
  subscriptionExpiresAt: string | null
}

export interface SubscriptionPlanPrice {
  id: string
  key: string
  label: string
  price: number
  currency: string
}

export interface GymWithBilling extends Gym {
  subscription: SubscriptionInfo | null
  billing: BillingRecord[]
}

export interface Money {
  amount: number
  currency: string
}

type GymList = { data: Gym[]; total: number } | Gym[]

/** Loads every gym with its subscription state and billing history (one request pair per gym). */
export async function loadGymsWithBilling(token: string, limit = 100): Promise<GymWithBilling[]> {
  const raw = await apiFetch<GymList>(`/admin/gyms?limit=${limit}`, token)
  const gyms: Gym[] = raw ? (Array.isArray(raw) ? raw : raw.data) : []

  return Promise.all(
    gyms.map(async (g) => {
      const [subscription, billing] = await Promise.all([
        apiFetch<SubscriptionInfo>(`/admin/gyms/${g.id}/subscription`, token),
        apiFetch<BillingRecord[]>(`/admin/gyms/${g.id}/billing-history`, token),
      ])
      return { ...g, logoUrl: normalizeLogoUrl(g.logoUrl), subscription, billing: billing ?? [] }
    }),
  )
}

/**
 * When a plan changes, the new billing record's period overlaps the previous one.
 * Keep only the latest record per subscription period so plan changes don't double-count.
 */
export function dedupeBilling(records: BillingRecord[]): BillingRecord[] {
  const sorted = [...records].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  const deduped: BillingRecord[] = []
  for (const record of sorted) {
    if (record.periodStart && record.periodEnd) {
      const pStart = new Date(record.periodStart).getTime()
      const pEnd = new Date(record.periodEnd).getTime()
      const idx = deduped.findIndex((r) => {
        if (!r.periodStart || !r.periodEnd) return false
        return new Date(r.periodStart).getTime() < pEnd && new Date(r.periodEnd).getTime() > pStart
      })
      if (idx !== -1) deduped.splice(idx, 1)
    }
    deduped.push(record)
  }
  return deduped
}

function inRange(iso: string, from: Date, to: Date) {
  const d = new Date(iso)
  return d >= from && d <= to
}

/** Sums by currency and returns the dominant one. */
export function sumByCurrency(items: Money[]): Money | null {
  const byCurrency: Record<string, number> = {}
  for (const { amount, currency } of items) {
    if (!isNaN(amount)) byCurrency[currency] = (byCurrency[currency] ?? 0) + amount
  }
  const entries = Object.entries(byCurrency).sort((a, b) => b[1] - a[1])
  if (entries.length === 0 || entries[0][1] <= 0) return null
  return { currency: entries[0][0], amount: entries[0][1] }
}

export function recordsBetween(gym: GymWithBilling, from: Date, to: Date) {
  return dedupeBilling(gym.billing.filter((b) => inRange(b.createdAt, from, to)))
}

export function revenueBetween(gyms: GymWithBilling[], from: Date, to: Date): Money | null {
  return sumByCurrency(
    gyms.flatMap((g) => recordsBetween(g, from, to).map((b) => ({ amount: parseFloat(b.amount), currency: b.currency }))),
  )
}

export function mainCurrency(gyms: GymWithBilling[]): string {
  const counts: Record<string, number> = {}
  for (const g of gyms) for (const b of g.billing) counts[b.currency] = (counts[b.currency] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? gyms[0]?.currency ?? 'ARS'
}

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export interface MonthPoint {
  key: string
  label: string
  amount: number
}

/** Revenue per calendar month (oldest first), in a single currency. */
export function monthlySeries(gyms: GymWithBilling[], months: number, currency: string, now = new Date()): MonthPoint[] {
  const points: MonthPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const amount = gyms
      .flatMap((g) => recordsBetween(g, start, end))
      .filter((b) => b.currency === currency)
      .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0)
    points.push({ key: `${start.getFullYear()}-${start.getMonth() + 1}`, label: MONTH_SHORT[start.getMonth()], amount })
  }
  return points
}

export const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
}

export function planPrice(plans: SubscriptionPlanPrice[], key: string | undefined | null): Money | null {
  if (!key) return null
  const plan = plans.find((p) => p.key.toUpperCase() === key.toUpperCase())
  if (!plan) return null
  const amount = parseFloat(String(plan.price))
  return amount > 0 ? { amount, currency: plan.currency } : null
}

export function daysUntil(iso: string, now = new Date()) {
  const ms = new Date(iso).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.ceil(ms / 86_400_000)
}

export function fmtMoney(m: Money | null | undefined, opts: { decimals?: boolean } = {}) {
  if (!m) return '—'
  const decimals = opts.decimals ?? false
  return `${m.currency} ${m.amount.toLocaleString('es-AR', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`
}

export function fmtAmount(amount: number) {
  return amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

export function fmtCompact(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 2 })}M`
  if (amount >= 1_000) return `${(amount / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })}k`
  return fmtAmount(amount)
}
