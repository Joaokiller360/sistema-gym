import { BarChart2, Users, TrendingUp, UserMinus, Clock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export interface AdvancedReport {
  revenueTrend: { label: string; amount: number }[]
  membersByPlan: { planName: string; count: number; percent: number }[]
  attendanceTrend: { label: string; count: number }[]
  newMembers: number
  churned: number
  expiringNext7Days: number
  peakDay: string | null
  peakHour: string | null
  currency: string
}

interface Props {
  gymSlug: string
  data: AdvancedReport | null
}

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('es-AR')}`
}

function MiniBarChart({ data, color = '#1fad9d' }: { data: { label: string; count: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className="w-full rounded-t-sm transition-all"
            style={{ height: `${Math.max(4, (d.count / max) * 56)}px`, background: color }}
          />
          <span className="text-[8px] text-zinc-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function RevenueBarChart({ data, currency }: { data: { label: string; amount: number }[]; currency: string }) {
  const max = Math.max(...data.map(d => d.amount), 1)
  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-1 h-20">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0 group relative">
            <div
              className="w-full rounded-t-sm bg-[#1fad9d] hover:bg-[#0e7a70] transition-colors cursor-default"
              style={{ height: `${Math.max(4, (d.amount / max) * 72)}px` }}
              title={`${d.label}: ${fmt(d.amount, currency)}`}
            />
            <span className="text-[8px] text-zinc-400 truncate w-full text-center">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdvancedReportsSection({ gymSlug, data }: Props) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 flex items-center gap-3 text-sm text-zinc-400">
        <BarChart2 className="h-5 w-5 shrink-0" />
        Sin datos de reportes avanzados disponibles
      </div>
    )
  }

  const kpis = [
    {
      label: 'Nuevos este mes',
      value: data.newMembers,
      icon: Users,
      color: 'text-[#1fad9d]',
      bg: 'bg-[#1fad9d]/10',
    },
    {
      label: 'Bajas este mes',
      value: data.churned,
      icon: UserMinus,
      color: 'text-red-500',
      bg: 'bg-red-50',
    },
    {
      label: 'Vencen en 7 días',
      value: data.expiringNext7Days,
      icon: AlertTriangle,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
    },
    {
      label: 'Hora pico',
      value: data.peakHour ?? '—',
      subtitle: data.peakDay ?? undefined,
      icon: Clock,
      color: 'text-zinc-600',
      bg: 'bg-zinc-100',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-violet-100 flex items-center justify-center">
            <BarChart2 className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="font-bold text-sm">Reportes Avanzados</p>
            <p className="text-[11px] text-zinc-400">Últimos 30 días</p>
          </div>
        </div>
        <Link
          href={`/gym/${gymSlug}/reports`}
          className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
        >
          Ver reportes completos →
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(({ label, value, subtitle, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-2xl border border-zinc-100 bg-white p-4 space-y-2">
            <div className={`h-8 w-8 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div>
              <p className="text-xl font-black tracking-tight leading-none">{value}</p>
              {subtitle && <p className="text-[10px] text-zinc-400 mt-0.5">{subtitle}</p>}
              <p className="text-[11px] text-zinc-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue trend */}
        {data.revenueTrend.length > 0 && (
          <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-[#1fad9d]" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Tendencia de ingresos</p>
            </div>
            <RevenueBarChart data={data.revenueTrend} currency={data.currency} />
            <p className="text-xs text-zinc-400 text-right">
              Total: <span className="font-bold text-zinc-700">{fmt(data.revenueTrend.reduce((s, d) => s + d.amount, 0), data.currency)}</span>
            </p>
          </div>
        )}

        {/* Members by plan */}
        {data.membersByPlan.length > 0 && (
          <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-zinc-400" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Distribución por plan</p>
            </div>
            <div className="space-y-2.5">
              {data.membersByPlan.map((p, i) => {
                const colors = ['bg-[#1fad9d]', 'bg-violet-500', 'bg-amber-400', 'bg-zinc-400', 'bg-blue-400']
                const barColor = colors[i % colors.length]
                return (
                  <div key={p.planName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-700 truncate max-w-[60%]">{p.planName}</span>
                      <span className="font-bold text-zinc-500">{p.count} · {p.percent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all`}
                        style={{ width: `${p.percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Attendance trend */}
      {data.attendanceTrend.length > 0 && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Asistencia últimos 7 días</p>
          </div>
          <MiniBarChart data={data.attendanceTrend} color="#18181b" />
        </div>
      )}
    </div>
  )
}
