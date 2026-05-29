import { cookies } from 'next/headers'
import Link from 'next/link'
import {
  ChevronRight, BarChart2, Lock, TrendingUp,
  Users, UserMinus, AlertTriangle, Clock, Zap,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { Gym } from '@/types'
import { type AdvancedReport } from '../../dashboard/AdvancedReportsSection'
import { MonthPicker } from './MonthPicker'

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ month?: string }>
}

function DeltaBadge({ n }: { n: number | null }) {
  if (n === null) return null
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${n >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      {n >= 0 ? '+' : ''}{n}%
    </span>
  )
}

function RevenueBar({ data, currency, color }: { data: { label: string; amount: number }[]; currency: string; color: string }) {
  if (!data.length) return <p className="text-xs text-zinc-400 py-10 text-center">Sin datos</p>
  const max = Math.max(...data.map(d => d.amount), 1)
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className="w-full rounded-t-md hover:opacity-80 transition-opacity"
            style={{ height: `${Math.max(4, (d.amount / max) * 116)}px`, background: color }}
            title={`${d.label}: ${currency} ${d.amount.toLocaleString('es-AR')}`}
          />
          <span className="text-[8px] text-zinc-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function AttendanceBar({ data }: { data: { label: string; count: number }[] }) {
  if (!data.length) return <p className="text-xs text-zinc-400 py-10 text-center">Sin datos</p>
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className="w-full rounded-t-md bg-zinc-900 hover:bg-zinc-700 transition-colors"
            style={{ height: `${Math.max(4, (d.count / max) * 104)}px` }}
            title={`${d.label}: ${d.count}`}
          />
          <span className="text-[8px] text-zinc-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function LockedPage({ gymSlug }: { gymSlug: string }) {
  const FEATURES = [
    { icon: TrendingUp,    label: 'Tendencia de ingresos semana a semana' },
    { icon: Users,         label: 'Distribución de miembros por plan' },
    { icon: UserMinus,     label: 'Altas y bajas del período' },
    { icon: BarChart2,     label: 'Comparativa vs mes anterior' },
    { icon: Clock,         label: 'Horario y día pico de asistencia' },
    { icon: AlertTriangle, label: 'Membresías próximas a vencer' },
  ]
  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-10">
        <Link href={`/gym/${gymSlug}/reports`} className="hover:text-zinc-700 transition-colors font-medium">
          Reportes
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-zinc-700 font-medium">Avanzados</span>
      </div>

      <div className="max-w-lg mx-auto mt-12 flex flex-col items-center gap-8 text-center">
        <div className="relative">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-violet-100 to-violet-50 border border-violet-100 flex items-center justify-center">
            <BarChart2 className="h-12 w-12 text-violet-400" />
          </div>
          <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-zinc-900 flex items-center justify-center border-2 border-white">
            <Lock className="h-3.5 w-3.5 text-white" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes Avanzados</h1>
          <p className="text-zinc-400 mt-2 text-sm leading-relaxed max-w-sm">
            Análisis profundo de tu gimnasio. Ingresos, retención, asistencia y tendencias comparativas mes a mes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left w-full">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-white p-3.5">
              <div className="h-7 w-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="h-3.5 w-3.5 text-violet-500" />
              </div>
              <span className="text-xs text-zinc-600 leading-snug">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
          <Zap className="h-4 w-4 text-zinc-400 shrink-0" />
          Contactá al administrador para activar esta función en tu plan
        </div>
      </div>
    </div>
  )
}

export default async function AdvancedReportsPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { month } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const session = await verifyToken(token)
  const isSuperAdmin = session?.role === 'SUPER_ADMIN'

  const now = new Date()
  const targetMonth = month ? new Date(month + '-01') : now
  const startDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1).toISOString()
  const endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59).toISOString()
  const prevMonthDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() - 1, 1)
  const prevStartDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1).toISOString()
  const prevEndDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const gym = await apiFetch<Gym>(`/gyms/${gymSlug}`, token)
  const advancedEnabled = isSuperAdmin || (gym?.advancedReportsEnabled ?? false)

  if (!advancedEnabled) return <LockedPage gymSlug={gymSlug} />

  const gymHeader = { headers: { 'x-gym-slug': gymSlug } }
  const [current, previous] = await Promise.all([
    apiFetch<AdvancedReport>(`/reports/advanced?startDate=${startDate}&endDate=${endDate}`, token, gymHeader),
    apiFetch<AdvancedReport>(`/reports/advanced?startDate=${prevStartDate}&endDate=${prevEndDate}`, token, gymHeader),
  ])

  const monthStr = targetMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const prevMonthStr = prevMonthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const defaultMonth = month ?? now.toISOString().slice(0, 7)

  const currency = current?.currency ?? previous?.currency ?? 'ARS'
  const fmt = (n: number) => `${currency} ${n.toLocaleString('es-AR')}`

  const curRevTotal = current?.revenueTrend.reduce((s, d) => s + d.amount, 0) ?? 0
  const prevRevTotal = previous?.revenueTrend.reduce((s, d) => s + d.amount, 0) ?? 0
  const revDelta = prevRevTotal > 0 ? Math.round(((curRevTotal - prevRevTotal) / prevRevTotal) * 100) : null
  const membersDelta = (current?.newMembers != null && previous?.newMembers != null && previous.newMembers > 0)
    ? Math.round(((current.newMembers - previous.newMembers) / previous.newMembers) * 100)
    : null

  const PLAN_COLORS = ['#8b5cf6', '#1fad9d', '#f59e0b', '#6b7280', '#3b82f6']

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-3">
          <Link href={`/gym/${gymSlug}/reports`} className="hover:text-zinc-600 transition-colors">
            Reportes
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-600 font-medium">Avanzados</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <BarChart2 className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reportes Avanzados</h1>
              <p className="text-sm text-zinc-400 capitalize">{monthStr}</p>
            </div>
          </div>
          <MonthPicker defaultMonth={defaultMonth} />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Ingresos</p>
            <DeltaBadge n={revDelta} />
          </div>
          <p className="text-xl font-black tracking-tight text-zinc-900 leading-none">{fmt(curRevTotal)}</p>
          <p className="text-xs text-zinc-400 truncate">{fmt(prevRevTotal)} en {prevMonthStr}</p>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nuevos</p>
            <DeltaBadge n={membersDelta} />
          </div>
          <p className="text-xl font-black tracking-tight text-zinc-900 leading-none">{current?.newMembers ?? '—'}</p>
          <p className="text-xs text-zinc-400">{previous?.newMembers ?? '—'} en {prevMonthStr}</p>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-3">
          <div className="flex items-center gap-1.5">
            <UserMinus className="h-3 w-3 text-red-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Bajas</p>
          </div>
          <p className="text-xl font-black tracking-tight text-zinc-900 leading-none">{current?.churned ?? '—'}</p>
          <p className="text-xs text-zinc-400">{previous?.churned ?? '—'} en {prevMonthStr}</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 space-y-3">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Vencen en 7 días</p>
          </div>
          <p className="text-xl font-black tracking-tight text-zinc-900 leading-none">{current?.expiringNext7Days ?? '—'}</p>
          <p className="text-xs text-amber-500/80">membresías próximas a vencer</p>
        </div>
      </div>

      {/* Revenue charts — current vs previous */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-violet-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 capitalize">{monthStr}</p>
            </div>
            <p className="text-sm font-bold text-zinc-900">{fmt(curRevTotal)}</p>
          </div>
          <RevenueBar data={current?.revenueTrend ?? []} currency={currency} color="#8b5cf6" />
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-zinc-300" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 capitalize">{prevMonthStr}</p>
            </div>
            <p className="text-sm font-bold text-zinc-400">{fmt(prevRevTotal)}</p>
          </div>
          <RevenueBar data={previous?.revenueTrend ?? []} currency={currency} color="#c4b5fd" />
        </div>
      </div>

      {/* Members by plan + Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(current?.membersByPlan.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-zinc-400" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Membresías activas por plan</p>
            </div>
            <div className="space-y-3">
              {current!.membersByPlan.map((p, i) => (
                <div key={p.planName} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-700 truncate max-w-[60%]">{p.planName}</span>
                    <span className="font-bold text-zinc-500 shrink-0 ml-2">{p.count} · {p.percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${p.percent}%`, background: PLAN_COLORS[i % PLAN_COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(current?.attendanceTrend.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Asistencia — últimos 7 días</p>
            </div>
            <AttendanceBar data={current!.attendanceTrend} />
          </div>
        )}
      </div>

      {/* Peak day / hour */}
      {(current?.peakDay || current?.peakHour) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {current.peakDay && (
            <div className="rounded-2xl border border-zinc-100 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Día con más asistencia</p>
              <p className="text-3xl font-black text-zinc-900 capitalize">{current.peakDay}</p>
            </div>
          )}
          {current.peakHour && (
            <div className="rounded-2xl border border-zinc-100 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Hora pico</p>
              <p className="text-3xl font-black text-zinc-900">{current.peakHour}</p>
            </div>
          )}
        </div>
      )}

      {!current && (
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-12 flex flex-col items-center gap-3 text-center">
          <BarChart2 className="h-8 w-8 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-400">Sin datos para este período</p>
        </div>
      )}
    </div>
  )
}
