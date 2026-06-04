'use client'

import { useRouter } from 'next/navigation'
import { Users, UserMinus, AlertTriangle, Clock, Download } from 'lucide-react'
import { type AdvancedReport } from '../dashboard/AdvancedReportsSection'

interface Props {
  defaultMonth: string
  view: 'daily' | 'monthly'
  gymTimezone: string
  advancedCurrent: AdvancedReport | null
  advancedPrevious: AdvancedReport | null
}

const PLAN_COLORS = ['#8b5cf6', '#1fad9d', '#f59e0b', '#6b7280', '#3b82f6']
const GROUP_BAR_COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e']

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
    <div className="flex items-end gap-1 h-32 overflow-x-auto">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-[18px]">
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

function AttendanceBarChart({ data, color = '#18181b' }: { data: { label: string; count: number }[]; color?: string }) {
  if (!data.length) return <p className="text-xs text-zinc-400 py-10 text-center">Sin datos</p>
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className="w-full rounded-t-md opacity-80 hover:opacity-100 transition-opacity"
            style={{ height: `${Math.max(3, (d.count / max) * 88)}px`, background: color }}
            title={`${d.label}: ${d.count}`}
          />
          <span className="text-[8px] text-zinc-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

async function exportToExcel(
  current: AdvancedReport | null,
  previous: AdvancedReport | null,
  monthStr: string,
  prevMonthStr: string,
  curRevTotal: number,
  prevRevTotal: number,
  view: 'daily' | 'monthly',
) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const currency = current?.currency ?? 'ARS'

  // KPIs
  const kpis = [
    ['Métrica', 'Mes actual', 'Mes anterior'],
    ['Ingresos', `${currency} ${curRevTotal.toLocaleString('es-AR')}`, `${currency} ${prevRevTotal.toLocaleString('es-AR')}`],
    ['Nuevos miembros', current?.newMembers ?? '—', previous?.newMembers ?? '—'],
    ['Bajas', current?.churned ?? '—', previous?.churned ?? '—'],
    ['Vencen en 7 días', current?.expiringNext7Days ?? '—', ''],
    ['Día pico', current?.peakDay ?? '—', ''],
    ['Hora pico', current?.peakHour ?? '—', ''],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpis), 'KPIs')

  // Revenue trend
  const revenueHeader = view === 'daily'
    ? [['Día', `Ingresos (${currency})`]]
    : [['Semana', `Ingresos ${monthStr} (${currency})`, `Ingresos ${prevMonthStr} (${currency})`]]
  const prevTrendMap = new Map((previous?.revenueTrend ?? []).map(d => [d.label, d.amount]))
  const revenueRows = view === 'daily'
    ? (current?.revenueTrend ?? []).map(d => [d.label, d.amount])
    : (current?.revenueTrend ?? []).map(d => [d.label, d.amount, prevTrendMap.get(d.label) ?? 0])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([...revenueHeader, ...revenueRows]), 'Ingresos')

  // Members by plan
  if ((current?.membersByPlan.length ?? 0) > 0) {
    const planRows = [['Plan', 'Membresías activas', '%'], ...current!.membersByPlan.map(p => [p.planName, p.count, `${p.percent}%`])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(planRows), 'Por plan')
  }

  // Attendance trend
  if ((current?.attendanceTrend.length ?? 0) > 0) {
    const attRows = [['Día', 'Check-ins'], ...current!.attendanceTrend.map(d => [d.label, d.count])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attRows), 'Asistencia')
  }

  XLSX.writeFile(wb, `reportes-${monthStr.replace(/ /g, '-')}.xlsx`)
}

export function AdvancedReports({ defaultMonth, view, gymTimezone, advancedCurrent, advancedPrevious }: Props) {
  const router = useRouter()
  const [curYear, curMonthNum] = defaultMonth
    ? defaultMonth.split('-').map(Number)
    : [new Date().getFullYear(), new Date().getMonth() + 1]
  const curMonth0 = curMonthNum - 1
  const prevYear = curMonth0 === 0 ? curYear - 1 : curYear
  const prevMonth0 = curMonth0 === 0 ? 11 : curMonth0 - 1
  // Use local Date constructor (not ISO string) to avoid UTC→local offset shifting month display
  const monthStr = new Date(curYear, curMonth0, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const prevMonthStr = new Date(prevYear, prevMonth0, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  const currency = advancedCurrent?.currency ?? advancedPrevious?.currency ?? 'ARS'
  const fmt = (n: number) => `${currency} ${n.toLocaleString('es-AR')}`
  // Revenue from memberships sold in period (plan price × count, via revenueTrend)
  const curRevTotal = advancedCurrent?.revenueTrend.reduce((s, d) => s + d.amount, 0) ?? 0
  const prevRevTotal = advancedPrevious?.revenueTrend.reduce((s, d) => s + d.amount, 0) ?? 0
  const realCurrentMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: gymTimezone, year: 'numeric', month: '2-digit',
  }).format(new Date()).slice(0, 7)
  const isCurReal = defaultMonth === realCurrentMonth
  const revDelta = view === 'monthly' && prevRevTotal > 0
    ? Math.round(((curRevTotal - prevRevTotal) / prevRevTotal) * 100)
    : null
  const membersDelta =
    view === 'monthly' &&
    advancedCurrent?.newMembers != null &&
    advancedPrevious?.newMembers != null &&
    advancedPrevious.newMembers > 0
      ? Math.round(((advancedCurrent.newMembers - advancedPrevious.newMembers) / advancedPrevious.newMembers) * 100)
      : null

  const handleExport = () => {
    exportToExcel(advancedCurrent, advancedPrevious, monthStr, prevMonthStr, curRevTotal, prevRevTotal, view)
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
          <p className="text-muted-foreground text-sm mt-1 capitalize">{monthStr}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex gap-1 border rounded-lg p-1 bg-muted/30">
            <button
              onClick={() => router.push(`?month=${defaultMonth}&view=monthly`)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => router.push(`?month=${defaultMonth}&view=daily`)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'daily' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Diario
            </button>
          </div>

          {/* Month picker */}
          <input
            type="month"
            defaultValue={defaultMonth}
            onChange={e => { if (e.target.value) router.push(`?month=${e.target.value}&view=${view}`) }}
            className="rounded-md border px-3 py-1.5 text-sm bg-background"
          />

          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Membresías</p>
            <DeltaBadge n={revDelta} />
          </div>
          <p className="text-xl font-black tracking-tight text-zinc-900 leading-none">{fmt(curRevTotal)}</p>
          {view === 'monthly' && <p className="text-xs text-zinc-400 truncate">{fmt(prevRevTotal)} en {prevMonthStr}</p>}
        </div>

        {(advancedCurrent?.storeRevenue ?? 0) > 0 && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Tienda contado</p>
            <p className="text-xl font-black tracking-tight text-zinc-900 leading-none">{fmt(advancedCurrent!.storeRevenue/100)}</p>
            <p className="text-xs text-emerald-600/60">ventas en efectivo/débito</p>
          </div>
        )}

        {(advancedCurrent?.storeCreditIssued ?? 0) > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Tienda crédito</p>
            <p className="text-xl font-black tracking-tight text-zinc-900 leading-none">{fmt(advancedCurrent!.storeCreditIssued/100)}</p>
            <p className="text-xs text-amber-600/60">descuentos de crédito</p>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nuevos</p>
            <DeltaBadge n={membersDelta} />
          </div>
          <p className="text-xl font-black tracking-tight text-zinc-900 leading-none">{advancedCurrent?.newMembers ?? '—'}</p>
          {view === 'monthly' && <p className="text-xs text-zinc-400">{advancedPrevious?.newMembers ?? '—'} en {prevMonthStr}</p>}
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-3">
          <div className="flex items-center gap-1.5">
            <UserMinus className="h-3 w-3 text-red-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Bajas</p>
          </div>
          <p className="text-xl font-black tracking-tight text-zinc-900 leading-none">{advancedCurrent?.churned ?? '—'}</p>
          {view === 'monthly' && <p className="text-xs text-zinc-400">{advancedPrevious?.churned ?? '—'} en {prevMonthStr}</p>}
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 space-y-3">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Vencen en 7 días</p>
          </div>
          <p className="text-xl font-black tracking-tight text-zinc-900 leading-none">{advancedCurrent?.expiringNext7Days ?? '—'}</p>
          <p className="text-xs text-amber-500/80">membresías próximas a vencer</p>
        </div>
      </div>

      {/* Revenue chart(s) */}
      {view === 'monthly' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`rounded-2xl p-5 space-y-4 ${isCurReal ? 'border-2 border-violet-500 bg-violet-50/30' : 'border border-zinc-100 bg-white'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isCurReal ? 'bg-violet-500' : 'bg-zinc-400'}`} />
                <p className={`text-xs font-bold uppercase tracking-widest capitalize ${isCurReal ? 'text-violet-600' : 'text-zinc-500'}`}>{monthStr}</p>
                {isCurReal && <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400 bg-violet-100 px-1.5 py-0.5 rounded-full">Actual</span>}
              </div>
              <p className="text-sm font-bold text-zinc-900">{fmt(curRevTotal)}</p>
            </div>
            <RevenueBar data={advancedCurrent?.revenueTrend ?? []} currency={currency} color="#8b5cf6" />
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-zinc-300" />
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 capitalize">{prevMonthStr}</p>
              </div>
              <p className="text-sm font-bold text-zinc-400">{fmt(prevRevTotal)}</p>
            </div>
            <RevenueBar data={advancedPrevious?.revenueTrend ?? []} currency={currency} color="#c4b5fd" />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-violet-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 capitalize">{monthStr} — por día</p>
            </div>
            <p className="text-sm font-bold text-zinc-900">{fmt(curRevTotal)}</p>
          </div>
          <RevenueBar data={advancedCurrent?.revenueTrend ?? []} currency={currency} color="#8b5cf6" />
        </div>
      )}

      {/* Store revenue */}
      {view === 'monthly' ? (
        ((advancedCurrent?.storeRevenue ?? 0) > 0 || (advancedCurrent?.storeCreditIssued ?? 0) > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(advancedCurrent?.storeRevenue ?? 0) > 0 && (
              <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Tienda — al contado</p>
                  </div>
                  <p className="text-sm font-bold text-zinc-900">{fmt(advancedCurrent!.storeRevenue/100)}</p>
                </div>
                <RevenueBar data={advancedCurrent?.storeSalesTrend ?? []} currency={currency} color="#10b981" />
              </div>
            )}
            {(advancedCurrent?.storeCreditIssued ?? 0) > 0 && (
              <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-400" />
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Tienda — en crédito</p>
                  </div>
                  <p className="text-sm font-bold text-zinc-900">{fmt(advancedCurrent!.storeCreditIssued/100)}</p>
                </div>
                <RevenueBar data={advancedCurrent?.storeCreditTrend ?? []} currency={currency} color="#f59e0b" />
              </div>
            )}
          </div>
        )
      ) : (
        ((advancedCurrent?.storeRevenue ?? 0) > 0 || (advancedCurrent?.storeCreditIssued ?? 0) > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(advancedCurrent?.storeRevenue ?? 0) > 0 && (
              <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Tienda al contado — por día</p>
                  </div>
                  <p className="text-sm font-bold text-zinc-900">{fmt(advancedCurrent!.storeRevenue/100)}</p>
                </div>
                <RevenueBar data={advancedCurrent?.storeSalesTrend ?? []} currency={currency} color="#10b981" />
              </div>
            )}
            {(advancedCurrent?.storeCreditIssued ?? 0) > 0 && (
              <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-400" />
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Tienda en crédito — por día</p>
                  </div>
                  <p className="text-sm font-bold text-zinc-900">{fmt(advancedCurrent!.storeCreditIssued/100)}</p>
                </div>
                <RevenueBar data={advancedCurrent?.storeCreditTrend ?? []} currency={currency} color="#f59e0b" />
              </div>
            )}
          </div>
        )
      )}

      {/* Members by plan + Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(advancedCurrent?.membersByPlan.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-zinc-400" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Membresías activas por plan</p>
            </div>
            <div className="space-y-3">
              {advancedCurrent!.membersByPlan.map((p, i) => (
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

        {(advancedCurrent?.attendanceTrend.length ?? 0) > 0 && (
          <div className="rounded-2xl border border-zinc-100 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Asistencia — últimos 7 días</p>
            </div>
            {(advancedCurrent?.attendanceTrendByGroup?.length ?? 0) > 0 ? (
              <div className="space-y-5">
                {advancedCurrent!.attendanceTrendByGroup.map((g, i) => (
                  <div key={g.groupId ?? 'ungrouped'}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className={`h-1.5 w-1.5 rounded-full`} style={{ background: GROUP_BAR_COLORS[i % GROUP_BAR_COLORS.length] }} />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{g.groupName ?? 'Sin grupo'}</p>
                    </div>
                    <AttendanceBarChart data={g.trend} color={GROUP_BAR_COLORS[i % GROUP_BAR_COLORS.length]} />
                  </div>
                ))}
              </div>
            ) : (
              <AttendanceBarChart data={advancedCurrent!.attendanceTrend} />
            )}
          </div>
        )}
      </div>

      {/* Peak day / hour */}
      {(advancedCurrent?.peakDay || advancedCurrent?.peakHour) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {advancedCurrent.peakDay && (
            <div className="rounded-2xl border border-zinc-100 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Día con más asistencia</p>
              <p className="text-3xl font-black text-zinc-900 capitalize">{advancedCurrent.peakDay}</p>
            </div>
          )}
          {advancedCurrent.peakHour && (
            <div className="rounded-2xl border border-zinc-100 bg-white p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Hora pico</p>
              <p className="text-3xl font-black text-zinc-900">{advancedCurrent.peakHour}</p>
            </div>
          )}
        </div>
      )}

      {!advancedCurrent && (
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-12 flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-zinc-400">Sin datos para este período</p>
        </div>
      )}
    </div>
  )
}
