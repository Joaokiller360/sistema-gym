import { cookies } from 'next/headers'
import { TrendingUp, DollarSign } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Gym } from '@/types'
import { IncomeClient } from './IncomeClient'

interface GymListResponse { data: Gym[]; total: number }

interface SubscriptionPlan {
  id: string
  key: string
  label: string
  price: number
  currency: string
}

interface SubscriptionInfo {
  subscriptionPlan: string
  subscriptionStatus: 'ACTIVE' | 'GRACE' | 'SUSPENDED'
  subscriptionExpiresAt: string | null
}

interface BillingRecord {
  id: string
  amount: string
  currency: string
  periodStart: string | null
  periodEnd: string | null
  createdAt: string
}

interface GymWithSubscription extends Gym {
  subscription?: SubscriptionInfo | null
  dailyRevenue?: { amount: number; currency: string } | null
  monthlyRevenue?: { amount: number; currency: string } | null
  billing: BillingRecord[]
}

const BACKEND_BASE = (process.env.API_URL ?? 'http://localhost:3001/api/v1').replace(/\/api\/v\d+$/, '')
const resolveLogoUrl = (url: string | null | undefined): string | null =>
  url?.startsWith('/') ? `${BACKEND_BASE}${url}` : url ?? null

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function fmtRevenue(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

function billingRevenue(records: BillingRecord[], from: Date, to: Date): { amount: number; currency: string } | null {
  const filtered = records.filter(b => {
    const d = new Date(b.createdAt)
    return d >= from && d <= to
  })
  if (filtered.length === 0) return null

  // When a plan changes, the new billing record's period overlaps the previous one.
  // Keep only the latest record per subscription period so plan changes don't double-count.
  const sorted = [...filtered].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  const deduped: BillingRecord[] = []
  for (const record of sorted) {
    if (record.periodStart && record.periodEnd) {
      const pStart = new Date(record.periodStart).getTime()
      const pEnd = new Date(record.periodEnd).getTime()
      const idx = deduped.findIndex(r => {
        if (!r.periodStart || !r.periodEnd) return false
        const rStart = new Date(r.periodStart).getTime()
        const rEnd = new Date(r.periodEnd).getTime()
        return rStart < pEnd && rEnd > pStart
      })
      if (idx !== -1) deduped.splice(idx, 1)
    }
    deduped.push(record)
  }

  const byCurrency: Record<string, number> = {}
  for (const b of deduped) {
    byCurrency[b.currency] = (byCurrency[b.currency] ?? 0) + parseFloat(b.amount)
  }
  const [currency, amount] = Object.entries(byCurrency).sort((a, b) => b[1] - a[1])[0]
  return { amount, currency }
}

function aggregateRevenue(perGym: ({ amount: number; currency: string } | null)[]): { amount: number; currency: string } | null {
  const byCurrency: Record<string, number> = {}
  for (const r of perGym) {
    if (!r) continue
    byCurrency[r.currency] = (byCurrency[r.currency] ?? 0) + r.amount
  }
  const entries = Object.entries(byCurrency)
  if (entries.length === 0) return null
  const [currency, amount] = entries.sort((a, b) => b[1] - a[1])[0]
  return { amount, currency }
}

export default async function AdminIncomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const now = new Date()
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)
  const monthStart = startOfMonth(now)

  const [gymsRaw, subPlans] = await Promise.all([
    apiFetch<GymListResponse | Gym[]>(`/admin/gyms?limit=100`, token),
    apiFetch<SubscriptionPlan[]>(`/admin/subscription-plans`, token),
  ])

  const gyms: Gym[] = gymsRaw
    ? (Array.isArray(gymsRaw) ? gymsRaw : gymsRaw.data)
    : []

  // Fetch subscription info + billing history for each gym in parallel
  const gymData = await Promise.all(gyms.map(async (g) => {
    const [sub, billing] = await Promise.all([
      apiFetch<SubscriptionInfo>(`/admin/gyms/${g.id}/subscription`, token),
      apiFetch<BillingRecord[]>(`/admin/gyms/${g.id}/billing-history`, token),
    ])
    return { gymId: g.id, subscription: sub, billing: billing ?? [] }
  }))

  const gymsWithSub: GymWithSubscription[] = gyms.map((g, i) => {
    const billing = gymData[i]?.billing ?? []
    return {
      ...g,
      logoUrl: resolveLogoUrl(g.logoUrl),
      subscription: gymData[i]?.subscription ?? null,
      dailyRevenue: billingRevenue(billing, dayStart, dayEnd),
      monthlyRevenue: billingRevenue(billing, monthStart, dayEnd),
      billing,
    }
  })

  const dailyRevenue = aggregateRevenue(gymsWithSub.map(g => g.dailyRevenue ?? null))
  const monthlyRevenue = aggregateRevenue(gymsWithSub.map(g => g.monthlyRevenue ?? null))

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ingresos</h1>
        <p className="text-muted-foreground text-sm mt-1">Control de suscripciones y pagos de gimnasios</p>
      </div>

      {/* Revenue cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest mb-3">
            <TrendingUp className="h-4 w-4" />
            Ingreso de hoy
          </div>
          <p className="text-3xl font-black tracking-tight">
            {dailyRevenue ? fmtRevenue(dailyRevenue.amount, dailyRevenue.currency) : '—'}
          </p>
          <p className="text-xs text-zinc-400">
            {now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest mb-3">
            <DollarSign className="h-4 w-4" />
            Ingreso del mes
          </div>
          <p className="text-3xl font-black tracking-tight">
            {monthlyRevenue ? fmtRevenue(monthlyRevenue.amount, monthlyRevenue.currency) : '—'}
          </p>
          <p className="text-xs text-zinc-400">
            {now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <IncomeClient gyms={gymsWithSub} subPlans={subPlans ?? []} />
    </div>
  )
}
