import { cookies } from 'next/headers'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import {
  daysUntil,
  fmtAmount,
  fmtCompact,
  mainCurrency,
  monthlySeries,
  recordsBetween,
  revenueBetween,
  type SubscriptionPlanPrice,
  loadGymsWithBilling,
} from '@/lib/admin-billing'
import {
  AdminPage,
  EmptyState,
  GymMark,
  Meter,
  PageHeader,
  Panel,
  PanelLink,
  PersonMark,
  Pill,
  SectionLabel,
  Stat,
  btn,
  td,
  th,
  type Tone,
} from '@/components/admin/ui'
import type { AccessRequest, DemoRequest } from '../acceso/RequestsInbox'

interface DashboardStats {
  totalGyms: number
  activeGyms: number
  totalUsers: number
  totalMembers: number
}

interface CountResponse {
  total?: number
  data?: unknown[]
}

interface SupportTicket {
  id: string
  title: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | 'NOTIFICATION'
  gymName?: string | null
  createdAt: string
}

type ListResponse<T> = T[] | { data: T[] }
const list = <T,>(raw: ListResponse<T> | null): T[] => (raw ? (Array.isArray(raw) ? raw : raw.data ?? []) : [])

const TICKET_STATUS: Record<SupportTicket['status'], { label: string; tone: Tone }> = {
  OPEN: { label: 'Abierto', tone: 'warn' },
  IN_PROGRESS: { label: 'En proceso', tone: 'info' },
  RESOLVED: { label: 'Resuelto', tone: 'ok' },
  CLOSED: { label: 'Cerrado', tone: 'neutral' },
}

const TICKET_PRIORITY: Record<SupportTicket['priority'], { label: string; tone: Tone }> = {
  URGENT: { label: 'Urgente', tone: 'bad' },
  HIGH: { label: 'Alta', tone: 'high' },
  NORMAL: { label: 'Normal', tone: 'neutral' },
  LOW: { label: 'Baja', tone: 'neutral' },
  NOTIFICATION: { label: 'Notificación', tone: 'ok' },
}

const SUB_LABEL = { ACTIVE: 'Activa', GRACE: 'Prórroga', SUSPENDED: 'Suspendida' } as const
const SUB_TONE: Record<keyof typeof SUB_LABEL, Tone> = { ACTIVE: 'ok', GRACE: 'warn', SUSPENDED: 'bad' }

function timeAgo(iso: string, now: Date) {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `hace ${Math.max(1, mins)} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

function AttentionCard({
  href,
  count,
  label,
  tag,
  tone,
}: {
  href: string
  count: number
  label: string
  tag: string
  tone: Tone
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 flex-1 basis-48 flex-col gap-1.5 rounded-xl border border-adm-line bg-adm-surface px-4.5 py-4 transition-colors hover:border-adm-ink"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-admin-mono text-[28px] font-bold leading-none">{count}</span>
        {count > 0 && <Pill tone={tone}>{tag}</Pill>}
      </div>
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  )
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const now = new Date()

  const [stats, gyms, subPlans, ticketsRaw, demosRaw, accessRaw] = await Promise.all([
    apiFetch<DashboardStats>(`/admin/dashboard`, token),
    loadGymsWithBilling(token),
    apiFetch<SubscriptionPlanPrice[]>(`/admin/subscription-plans`, token, { silent: true }),
    apiFetch<ListResponse<SupportTicket>>(`/support/tickets?all=true`, token, { silent: true }),
    apiFetch<ListResponse<DemoRequest>>(`/admin/demo-requests?limit=100`, token, { silent: true }),
    apiFetch<ListResponse<AccessRequest>>(`/access-requests/admin?limit=100`, token, { silent: true }),
  ])

  const tickets = list(ticketsRaw).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const demos = list(demosRaw).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const access = list(accessRaw)

  const openTickets = tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS')
  const urgentOpen = openTickets.filter((t) => t.priority === 'URGENT').length
  const pendingAccess = access.filter((r) => r.status === 'PENDING').length
  const pendingDemos = demos.filter((d) => d.status === 'PENDING')
  const expiringSoon = gyms.filter((g) => {
    const s = g.subscription
    if (!s?.subscriptionExpiresAt || s.subscriptionStatus !== 'ACTIVE') return false
    const d = daysUntil(s.subscriptionExpiresAt, now)
    return d >= 0 && d <= 7
  }).length

  // Revenue
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevSameDay = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 23, 59, 59, 999)
  const daily = revenueBetween(gyms, dayStart, now)
  const dailyCount = gyms.reduce((n, g) => n + recordsBetween(g, dayStart, now).length, 0)
  const monthly = revenueBetween(gyms, monthStart, now)
  const prevMonthly = revenueBetween(gyms, prevStart, prevSameDay)
  const monthDelta =
    monthly && prevMonthly && prevMonthly.currency === monthly.currency && prevMonthly.amount > 0
      ? ((monthly.amount - prevMonthly.amount) / prevMonthly.amount) * 100
      : null
  const prevMonthName = prevStart.toLocaleDateString('es-AR', { month: 'long' })

  const currency = mainCurrency(gyms)
  const series = monthlySeries(gyms, 12, currency, now)
  const seriesMax = Math.max(1, ...series.map((p) => p.amount))

  // Plans
  const planCounts = new Map<string, number>()
  for (const g of gyms) {
    const key = (g.subscription?.subscriptionPlan ?? g.subscriptionPlan ?? '').toUpperCase()
    if (key) planCounts.set(key, (planCounts.get(key) ?? 0) + 1)
  }
  const planRows = [...planCounts.entries()]
    .map(([key, count]) => ({
      key,
      count,
      label: subPlans?.find((p) => p.key.toUpperCase() === key)?.label ?? key,
    }))
    .sort((a, b) => b.count - a.count)
  const graceCount = gyms.filter((g) => g.subscription?.subscriptionStatus === 'GRACE').length
  const suspendedCount = gyms.filter((g) => g.subscription?.subscriptionStatus === 'SUSPENDED').length

  // Recent gyms
  const recentGyms = [...gyms]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
  const memberCounts = await Promise.all(
    recentGyms.map(async (g) => {
      const res = await apiFetch<CountResponse | unknown[]>(`/members?gymId=${g.id}&limit=1`, token, { silent: true })
      return Array.isArray(res) ? res.length : (res as CountResponse | null)?.total ?? null
    }),
  )

  const totalGyms = stats?.totalGyms ?? gyms.length
  const activeGyms = stats?.activeGyms ?? gyms.filter((g) => g.isActive).length
  const dateLabel = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <AdminPage>
      <PageHeader
        eyebrow={<span className="capitalize">{dateLabel}</span>}
        title="Panel de control"
        actions={
          <>
            <Link href="/admin/income" className={btn.line}>
              Ver ingresos
            </Link>
            <Link href="/admin/gyms/new" className={btn.primary}>
              <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
              Nuevo gimnasio
            </Link>
          </>
        }
      />

      <section aria-labelledby="attn-h" className="flex flex-col gap-2.5">
        <SectionLabel id="attn-h">Requiere atención</SectionLabel>
        <div className="flex flex-wrap gap-3">
          <AttentionCard
            href="/admin/support"
            count={openTickets.length}
            label="Tickets de soporte abiertos"
            tag={urgentOpen > 0 ? `${urgentOpen} urgente${urgentOpen !== 1 ? 's' : ''}` : 'Abiertos'}
            tone={urgentOpen > 0 ? 'bad' : 'warn'}
          />
          <AttentionCard href="/admin/acceso" count={pendingAccess} label="Solicitudes de acceso" tag="Pendientes" tone="warn" />
          <AttentionCard href="/admin/acceso" count={pendingDemos.length} label="Demos solicitadas" tag="Sin contactar" tone="neutral" />
          <AttentionCard href="/admin/income" count={expiringSoon} label="Suscripciones por vencer" tag="≤ 7 días" tone="high" />
        </div>
      </section>

      <section aria-label="Indicadores" className="flex flex-wrap gap-3">
        <Stat label="Gimnasios activos" value={activeGyms}>
          <span className="-mt-1 block font-admin-mono text-[15px] text-adm-muted">de {totalGyms}</span>
          <Meter value={totalGyms ? (activeGyms / totalGyms) * 100 : 0} className="mt-3" />
        </Stat>
        <Stat label="Miembros totales" value={stats ? fmtAmount(stats.totalMembers) : '—'} hint={stats ? `${fmtAmount(stats.totalUsers)} usuarios en la plataforma` : undefined} />
        <Stat
          label="Ingreso de hoy"
          unit={daily?.currency}
          value={daily ? fmtAmount(daily.amount) : '—'}
          hint={`${dailyCount} pago${dailyCount !== 1 ? 's' : ''} registrado${dailyCount !== 1 ? 's' : ''}`}
        />
        <Stat
          label="Ingreso del mes"
          unit={monthly?.currency}
          value={monthly ? fmtCompact(monthly.amount) : '—'}
          hint={monthDelta !== null ? `${monthDelta >= 0 ? '+' : ''}${monthDelta.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% vs. mismo período de ${prevMonthName}` : undefined}
          hintTone={monthDelta !== null && monthDelta < 0 ? 'bad' : 'ok'}
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <section aria-labelledby="rev-h" className="min-w-0 flex-[2_1_480px] rounded-2xl border border-adm-line bg-adm-night p-6 text-white">
          <h2 id="rev-h" className="text-[15px] font-bold">Ingresos por mes</h2>
          <p className="mt-1 text-[13px] text-[#a3a39d]">Últimos 12 meses · {currency}</p>
          <div className="mt-7 flex h-[200px] items-end gap-2 border-b border-[#2a2a2c]" role="img" aria-label={`Ingresos de los últimos 12 meses en ${currency}`}>
            {series.map((p, i) => {
              const current = i === series.length - 1
              return (
                <div key={p.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${p.label}: ${currency} ${fmtAmount(p.amount)}`}>
                  {current && p.amount > 0 && (
                    <span className="font-admin-mono text-[11px] font-bold text-adm-brand">{fmtCompact(p.amount)}</span>
                  )}
                  <div
                    className={current ? 'w-full max-w-9 rounded-t bg-adm-brand' : 'w-full max-w-9 rounded-t bg-[#3a3a3d]'}
                    style={{ height: `${Math.max(p.amount > 0 ? 2 : 0, (p.amount / seriesMax) * 88)}%` }}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex gap-2" aria-hidden="true">
            {series.map((p) => (
              <div key={p.key} className="min-w-0 flex-1 text-center text-[11px] text-[#a3a39d]">{p.label}</div>
            ))}
          </div>
        </section>

        <Panel
          title="Gimnasios por plan"
          id="plan-h"
          action={<PanelLink href="/admin/plans">Planes</PanelLink>}
          className="min-w-0 flex-[1_1_280px]"
          bodyClassName="flex flex-col gap-4 p-5"
        >
          {planRows.length === 0 ? (
            <p className="text-sm text-adm-muted">Sin datos de suscripción.</p>
          ) : (
            planRows.map((p) => (
              <div key={p.key} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold">{p.label}</span>
                  <span className="font-admin-mono">{p.count}</span>
                </div>
                <Meter value={(p.count / gyms.length) * 100} className="h-2.5" />
              </div>
            ))
          )}
          <div className="mt-auto flex flex-col gap-2 border-t border-adm-line-soft pt-4 text-[13px]">
            <div className="flex justify-between"><span className="text-adm-muted">En prórroga</span><span className="font-admin-mono font-bold text-adm-warn-fg">{graceCount}</span></div>
            <div className="flex justify-between"><span className="text-adm-muted">Suspendidos</span><span className="font-admin-mono font-bold text-adm-bad-fg">{suspendedCount}</span></div>
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap gap-3">
        <Panel title="Últimos tickets" id="tk-h" action={<PanelLink href="/admin/support">Ver todos</PanelLink>} className="min-w-0 flex-[1_1_380px]">
          {tickets.length === 0 ? (
            <EmptyState>Sin tickets de soporte.</EmptyState>
          ) : (
            <ul>
              {tickets.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center gap-3 border-t border-adm-line-soft px-5 py-3.5 first:border-t-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <p className="truncate text-sm font-semibold">{t.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Pill tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Pill>
                      <Pill tone={TICKET_PRIORITY[t.priority].tone}>{TICKET_PRIORITY[t.priority].label}</Pill>
                      {t.gymName && <Pill className="font-medium">{t.gymName}</Pill>}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-adm-muted">
                    {new Date(t.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Demos sin contactar" id="demo-h" action={<PanelLink href="/admin/acceso">Ver todas</PanelLink>} className="min-w-0 flex-[1_1_380px]">
          {pendingDemos.length === 0 ? (
            <EmptyState>No hay demos pendientes.</EmptyState>
          ) : (
            <ul>
              {pendingDemos.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center gap-3 border-t border-adm-line-soft px-5 py-3.5 first:border-t-0">
                  <PersonMark name={d.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{d.name}</p>
                    <p className="mt-0.5 truncate text-xs text-adm-muted">
                      {d.gymName} · {d.planLabel} · {timeAgo(d.createdAt, now)}
                    </p>
                  </div>
                  <Link href="/admin/acceso?tab=demo" className={btn.line}>Contactar</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Gimnasios recientes" id="gy-h" action={<PanelLink href="/admin/gyms">Ver todos</PanelLink>}>
        {recentGyms.length === 0 ? (
          <EmptyState icon={<Building2 className="size-10" />}>Sin gimnasios registrados</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className={`${th} pl-5`}>Gimnasio</th>
                  <th scope="col" className={th}>Plan</th>
                  <th scope="col" className={th}>Miembros</th>
                  <th scope="col" className={th}>Suscripción</th>
                  <th scope="col" className={`${th} pr-5`}><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {recentGyms.map((g, i) => {
                  const status = g.subscription?.subscriptionStatus
                  const planKey = g.subscription?.subscriptionPlan ?? g.subscriptionPlan
                  return (
                    <tr key={g.id} className="hover:bg-adm-subtle">
                      <td className={`${td} pl-5`}>
                        <div className="flex items-center gap-3">
                          <GymMark name={g.name} logoUrl={g.logoUrl} />
                          <div className="min-w-0">
                            <p className="truncate font-bold">{g.name}</p>
                            <p className="font-admin-mono text-xs text-adm-muted">/{g.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className={td}>{subPlans?.find((p) => p.key.toUpperCase() === planKey?.toUpperCase())?.label ?? planKey ?? '—'}</td>
                      <td className={`${td} font-admin-mono`}>{memberCounts[i] ?? '—'}</td>
                      <td className={td}>
                        {!g.isActive ? (
                          <Pill>Inactivo</Pill>
                        ) : status ? (
                          <Pill tone={SUB_TONE[status]}>{SUB_LABEL[status]}</Pill>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={`${td} pr-5`}>
                        <div className="flex justify-end gap-2">
                          <Link href={`/gym/${g.slug}/dashboard`} className={btn.dark}>Entrar</Link>
                          <Link href={`/admin/gyms/${g.id}`} className={btn.line}>Detalle</Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AdminPage>
  )
}
