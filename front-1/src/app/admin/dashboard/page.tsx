import { cookies } from 'next/headers'
import Link from 'next/link'
import { Building2, Users, ChevronRight, TrendingUp, DollarSign } from 'lucide-react'
import { KpiCard } from '@/components/shared/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { apiFetch } from '@/lib/api'
import { Gym } from '@/types'

interface DashboardStats {
  totalGyms: number
  activeGyms: number
  totalUsers: number
  totalMembers: number
}

interface GymListResponse {
  data: Gym[]
  total: number
}

interface CountResponse {
  total?: number
  data?: unknown[]
}

interface BillingRecord {
  amount: string
  currency: string
  periodStart: string | null
  periodEnd: string | null
  createdAt: string
}

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }

function fmtRevenue(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

function gymBillingRevenue(records: BillingRecord[], from: Date, to: Date): { amount: number; currency: string } | null {
  const filtered = records.filter(b => {
    const d = new Date(b.createdAt)
    return d >= from && d <= to
  })
  if (filtered.length === 0) return null

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
  const entries = Object.entries(byCurrency)
  if (entries.length === 0) return null
  return { currency: entries[0][0], amount: entries[0][1] }
}

function sumBilling(perGym: BillingRecord[][], from: Date, to: Date): { amount: number; currency: string } | null {
  const byCurrency: Record<string, number> = {}
  for (const records of perGym) {
    const rev = gymBillingRevenue(records, from, to)
    if (!rev) continue
    byCurrency[rev.currency] = (byCurrency[rev.currency] ?? 0) + rev.amount
  }
  const entries = Object.entries(byCurrency)
  if (entries.length === 0) return null
  const [currency, amount] = entries.sort((a, b) => b[1] - a[1])[0]
  return { amount, currency }
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const now = new Date()
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)
  const monthStart = startOfMonth(now)

  const [stats, gymsRaw, allGymsRaw] = await Promise.all([
    apiFetch<DashboardStats>(`/admin/dashboard`, token),
    apiFetch<GymListResponse | Gym[]>(`/admin/gyms?limit=5`, token),
    apiFetch<GymListResponse | Gym[]>(`/admin/gyms?limit=200`, token),
  ])

  const allGyms: Gym[] = allGymsRaw
    ? (Array.isArray(allGymsRaw) ? allGymsRaw : allGymsRaw.data)
    : []

  const allBilling = await Promise.all(
    allGyms.map(g => apiFetch<BillingRecord[]>(`/admin/gyms/${g.id}/billing-history`, token).then(r => r ?? []))
  )

  const dailyRevenue = sumBilling(allBilling, dayStart, dayEnd)
  const monthlyRevenue = sumBilling(allBilling, monthStart, dayEnd)

  const recentGyms: Gym[] = gymsRaw
    ? (Array.isArray(gymsRaw) ? gymsRaw : gymsRaw.data).slice(0, 5)
    : []

  const counts = await Promise.all(
    recentGyms.map(async (g) => {
      const membersRes = await apiFetch<CountResponse | unknown[]>(`/members?gymId=${g.id}&limit=1`, token)
      const members = Array.isArray(membersRes) ? membersRes.length : (membersRes as CountResponse)?.total ?? 0
      return { gymId: g.id, members }
    })
  )

  const countMap = Object.fromEntries(counts.map(c => [c.gymId, c]))

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Vista global</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard title="Gimnasios activos" value={stats?.activeGyms ?? '—'} icon={Building2} />
        <KpiCard title="Total gimnasios" value={stats?.totalGyms ?? '—'} icon={Building2} />
        <KpiCard title="Miembros totales" value={stats?.totalMembers ?? '—'} icon={Users} />
      </div>

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

      {/* Recent gyms table */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-sm">Gimnasios recientes</h2>
          <Link
            href="/admin/gyms"
            className="text-xs font-semibold text-[#1fad9d] hover:text-[#0e7a70] transition-colors flex items-center gap-1"
          >
            Ver todos
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentGyms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-sm text-zinc-400">
            <Building2 className="h-10 w-10 mb-3 opacity-20" />
            Sin gimnasios registrados
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500">Gimnasio</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden md:table-cell">Miembros</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {recentGyms.map(g => (
                <tr key={g.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
                        {g.logoUrl
                          ? <img src={g.logoUrl} alt={g.name} className="h-full w-full object-cover" />
                          : <span className="text-xs font-black text-black">{initials(g.name)}</span>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{g.name}</p>
                        <p className="text-xs text-zinc-400">{g.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="font-medium">{countMap[g.id]?.members ?? '—'}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={g.isActive ? 'active' : 'inactive'} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/gym/${g.slug}/dashboard`}
                        className="inline-flex items-center gap-1 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-all"
                      >
                        Entrar
                      </Link>
                      <Link
                        href={`/admin/gyms/${g.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:border-zinc-300 hover:text-black transition-all"
                      >
                        Ver más
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
