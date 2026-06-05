import { cookies } from 'next/headers'
import Link from 'next/link'
import { Building2, Users, ChevronRight, TrendingUp, DollarSign, LifeBuoy, CreditCard, Settings, ArrowUpRight, AlertTriangle, ArrowUp, Minus, ArrowDown, Bell, Circle, Clock, CheckCircle2 } from 'lucide-react'
import { KpiCard } from '@/components/shared/KpiCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { apiFetch } from '@/lib/api'
import { Gym } from '@/types'
import { NewsSection } from '@/app/gym/[gymSlug]/dashboard/NewsSection'
import { TutorialsSection } from '@/app/gym/[gymSlug]/dashboard/TutorialsSection'
import { DemoRequestsSection, type DemoRequest } from './DemoRequestsSection'

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

interface SupportTicket {
  id: string
  title: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | 'NOTIFICATION'
  category: string
  gymName?: string | null
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

  const byCurrency: Record<string, number> = {}
  for (const b of filtered) {
    const amt = parseFloat(b.amount)
    if (!isNaN(amt)) {
      byCurrency[b.currency] = (byCurrency[b.currency] ?? 0) + amt
    }
  }
  const entries = Object.entries(byCurrency)
  if (entries.length === 0) return null
  const [currency, amount] = entries.sort((a, b) => b[1] - a[1])[0]
  if (amount <= 0) return null
  return { currency, amount }
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
  if (amount <= 0) return null
  return { amount, currency }
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

const resolveLogoUrl = (url: string | null | undefined): string | null =>
  url ? url.replace(/^https?:\/\/[^/]+/, '') : null

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const now = new Date()
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)
  const monthStart = startOfMonth(now)

  const [stats, gymsRaw, ticketsRaw, demoRequestsRaw] = await Promise.all([
    apiFetch<DashboardStats>(`/admin/dashboard`, token),
    apiFetch<GymListResponse | Gym[]>(`/admin/gyms?limit=5`, token),
    apiFetch<SupportTicket[] | { data: SupportTicket[] }>(`/support/tickets?all=true`, token, { silent: true }),
    apiFetch<DemoRequest[] | { data: DemoRequest[] }>(`/admin/demo-requests?limit=100`, token, { silent: true }),
  ])

  const recentGyms: Gym[] = (gymsRaw
    ? (Array.isArray(gymsRaw) ? gymsRaw : gymsRaw.data).slice(0, 5)
    : []
  ).map(g => ({ ...g, logoUrl: resolveLogoUrl(g.logoUrl) }))

  const recentBilling = await Promise.all(
    recentGyms.map(g => apiFetch<BillingRecord[]>(`/admin/gyms/${g.id}/billing-history`, token).then(r => r ?? []))
  )

  const dailyRevenue = sumBilling(recentBilling, dayStart, dayEnd)
  const monthlyRevenue = sumBilling(recentBilling, monthStart, dayEnd)

  const counts = await Promise.all(
    recentGyms.map(async (g) => {
      const membersRes = await apiFetch<CountResponse | unknown[]>(`/members?gymId=${g.id}&limit=1`, token)
      const members = Array.isArray(membersRes) ? membersRes.length : (membersRes as CountResponse)?.total ?? 0
      return { gymId: g.id, members }
    })
  )

  const countMap = Object.fromEntries(counts.map(c => [c.gymId, c]))

  const tickets: SupportTicket[] = ticketsRaw
    ? (Array.isArray(ticketsRaw) ? ticketsRaw : ticketsRaw.data)
    : []

  const demoRequests: DemoRequest[] = demoRequestsRaw
    ? (Array.isArray(demoRequestsRaw) ? demoRequestsRaw : demoRequestsRaw.data)
    : []

  const latestTickets = tickets
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
  const openTickets = tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length

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

      {/* Quick access */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {([
            { href: '/admin/gyms', icon: Building2, label: 'Gimnasios', desc: `${stats?.totalGyms ?? 0} registrados` },
            { href: '/admin/income', icon: DollarSign, label: 'Ingresos', desc: 'Facturación' },
            { href: '/admin/support', icon: LifeBuoy, label: 'Soporte', desc: openTickets > 0 ? `${openTickets} abierto${openTickets !== 1 ? 's' : ''}` : 'Sin pendientes' },
            { href: '/admin/plans', icon: CreditCard, label: 'Planes', desc: 'Suscripciones' },
            { href: '/admin/settings', icon: Settings, label: 'Configuración', desc: 'Ajustes globales' },
          ] as const).map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:shadow-sm transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-xl bg-zinc-100 flex items-center justify-center group-hover:bg-[#fffb00] transition-colors">
                  <Icon className="h-4 w-4 text-zinc-600 group-hover:text-black transition-colors" />
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-800">{label}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Latest support tickets */}
      {latestTickets.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-zinc-400" />
              <h2 className="font-semibold text-sm">Últimos tickets de soporte</h2>
              {openTickets > 0 && (
                <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{openTickets}</span>
              )}
            </div>
            <Link href="/admin/support" className="text-xs font-semibold text-[#1fad9d] hover:text-[#0e7a70] transition-colors flex items-center gap-1">
              Ver todos <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-zinc-100">
            {latestTickets.map(t => {
              const priorityConfig = {
                URGENT: { color: 'bg-red-50 text-red-600 border-red-200', icon: <AlertTriangle className="h-3 w-3" />, label: 'Urgente' },
                HIGH: { color: 'bg-orange-50 text-orange-600 border-orange-200', icon: <ArrowUp className="h-3 w-3" />, label: 'Alta' },
                NORMAL: { color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <Minus className="h-3 w-3" />, label: 'Normal' },
                LOW: { color: 'bg-zinc-50 text-zinc-500 border-zinc-200', icon: <ArrowDown className="h-3 w-3" />, label: 'Baja' },
                NOTIFICATION: { color: 'bg-[#1fad9d]/10 text-[#0e7a70] border-[#1fad9d]/30', icon: <Bell className="h-3 w-3" />, label: 'Notif.' },
              }[t.priority]
              const statusConfig = {
                OPEN: { color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Circle className="h-3 w-3" />, label: 'Abierto' },
                IN_PROGRESS: { color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <Clock className="h-3 w-3" />, label: 'En proceso' },
                RESOLVED: { color: 'bg-[#1fad9d]/10 text-[#0e7a70] border-[#1fad9d]/30', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Resuelto' },
                CLOSED: { color: 'bg-zinc-50 text-zinc-400 border-zinc-200', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Cerrado' },
              }[t.status]
              return (
                <li key={t.id} className="flex items-center gap-4 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusConfig.color}`}>
                        {statusConfig.icon}{statusConfig.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityConfig.color}`}>
                        {priorityConfig.icon}{priorityConfig.label}
                      </span>
                      {t.gymName && (
                        <span className="text-[10px] text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-full px-2 py-0.5">{t.gymName}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-zinc-700 truncate">{t.title}</p>
                  </div>
                  <p className="text-xs text-zinc-400 shrink-0">{new Date(t.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Demo requests */}
      <DemoRequestsSection requests={demoRequests} />

      {/* News & Tutorials — managed here, visible in gym dashboards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NewsSection canManage={true} />
        <TutorialsSection canManage={true} />
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
