'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, Download, FileText, Loader2, Mail } from 'lucide-react'
import { type AdvancedReport } from '../dashboard/AdvancedReportsSection'
import { AdminPage, btn } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { emailMonthlyReport } from './actions'

interface Props {
  gymSlug: string
  defaultMonth: string
  view: 'daily' | 'monthly'
  gymTimezone: string
  advancedCurrent: AdvancedReport | null
  advancedPrevious: AdvancedReport | null
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function pct(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
}

/** Delta pill on the dark hero surface. */
function NightDelta({ n }: { n: number | null }) {
  if (n === null) return null
  const up = n >= 0
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-bold',
      up ? 'bg-[#0f2a27] text-[#5fd4c4]' : 'bg-[#2e1513] text-[#ff8a80]',
    )}>
      {up ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />}
      {Math.abs(n)}%
    </span>
  )
}

/** Member payments per bucket: current period in brand yellow, previous month (monthly view) in grey. */
function HeroBars({ cur, prev, fmt }: {
  cur: { label: string; amount: number }[]
  prev: { label: string; amount: number }[] | null
  fmt: (n: number) => string
}) {
  if (!cur.length) return <p className="py-16 text-center text-sm text-[#a3a39d]">Sin ventas de membresías en este período</p>
  const max = Math.max(1, ...cur.map(d => d.amount), ...(prev ?? []).map(d => d.amount))
  const dense = cur.length > 10
  const every = dense ? Math.ceil(cur.length / 8) : 1
  return (
    <>
      <div className={cn('flex h-[200px] items-end border-b border-[#2a2a2e]', dense ? 'gap-1' : 'gap-3.5')} role="img" aria-label="Ingresos de membresías por período">
        {cur.map((d, i) => {
          const p = prev?.[i]?.amount
          return (
            <div
              key={d.label}
              className="flex h-full min-w-0 flex-1 items-end justify-center gap-1"
              title={`${d.label}: ${fmt(d.amount)}${p !== undefined ? ` · mes anterior ${fmt(p)}` : ''}`}
            >
              {prev && (
                <div className="w-full max-w-[30px] rounded-t-md bg-[#3a3a3d]" style={{ height: `${Math.max(2, (p ?? 0) / max * 100)}%` }} />
              )}
              <div className="w-full max-w-[30px] rounded-t-md bg-adm-brand" style={{ height: `${Math.max(2, d.amount / max * 100)}%` }} />
            </div>
          )
        })}
      </div>
      <div className={cn('mt-2 flex', dense ? 'gap-1' : 'gap-3.5')} aria-hidden="true">
        {cur.map((d, i) => (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center font-admin-mono text-xs">
            <span className="truncate text-[#a3a39d]">{i % every === 0 ? d.label : ''}</span>
            {!dense && <span className="truncate text-[#f2f2ee]">{d.amount.toLocaleString('es-AR')}</span>}
          </div>
        ))}
      </div>
    </>
  )
}

function KpiCard({ label, value, foot, badge, tone }: {
  label: string
  value: React.ReactNode
  foot?: React.ReactNode
  badge?: React.ReactNode
  tone?: 'warn'
}) {
  return (
    <div className={cn(
      'flex flex-col gap-2.5 rounded-2xl border p-5',
      tone === 'warn' ? 'border-adm-warn-line bg-adm-warn-bg text-adm-warn-fg' : 'border-adm-line bg-adm-surface',
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-[13px] font-semibold', tone === 'warn' ? '' : 'text-adm-muted')}>{label}</p>
        {badge}
      </div>
      <p className="text-4xl font-black leading-none tracking-tight text-adm-ink">{value}</p>
      {foot && <div className={cn('text-[13px]', tone === 'warn' ? '' : 'text-adm-muted')}>{foot}</div>}
    </div>
  )
}

function GoodBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-adm-ok-line bg-adm-ok-bg px-2.5 py-0.5 text-xs font-bold text-adm-ok-fg">{children}</span>
}

function BadBadge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-adm-bad-line bg-adm-bad-bg px-2.5 py-0.5 text-xs font-bold text-adm-bad-fg">{children}</span>
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

export function AdvancedReports({ gymSlug, defaultMonth, view, gymTimezone, advancedCurrent, advancedPrevious }: Props) {
  const router = useRouter()
  const [sending, startSending] = useTransition()
  const [downloading, setDownloading] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

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
  // Member payments registered in period (via revenueTrend); deleted payments drop out
  const curRevTotal = advancedCurrent?.revenueTrend.reduce((s, d) => s + d.amount, 0) ?? 0
  const prevRevTotal = advancedPrevious?.revenueTrend.reduce((s, d) => s + d.amount, 0) ?? 0
  // Store totals arrive in cents (not covered by the money interceptor)
  const curStoreCash = (advancedCurrent?.storeRevenue ?? 0) / 100
  const curStoreCredit = (advancedCurrent?.storeCreditIssued ?? 0) / 100
  const curTotal = curRevTotal + curStoreCash + curStoreCredit
  const prevTotal = prevRevTotal + ((advancedPrevious?.storeRevenue ?? 0) + (advancedPrevious?.storeCreditIssued ?? 0)) / 100
  const share = (n: number) => (curTotal > 0 ? (n / curTotal) * 100 : 0)

  const realCurrentMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: gymTimezone, year: 'numeric', month: '2-digit',
  }).format(new Date()).slice(0, 7)
  const monthly = view === 'monthly'
  const totalDelta = monthly ? pct(curTotal, prevTotal) : null
  const membersDelta = monthly && advancedCurrent && advancedPrevious ? pct(advancedCurrent.newMembers, advancedPrevious.newMembers) : null
  const churnDiff = monthly && advancedCurrent && advancedPrevious ? advancedCurrent.churned - advancedPrevious.churned : null
  const net = advancedCurrent ? advancedCurrent.newMembers - advancedCurrent.churned : null
  const activeTotal = advancedCurrent?.membersByPlan.reduce((s, p) => s + p.count, 0) ?? 0

  const attendance = advancedCurrent?.attendanceTrend ?? []
  const attendanceTotal = attendance.reduce((s, d) => s + d.count, 0)
  const attendancePeak = Math.max(0, ...attendance.map(d => d.count))
  const groups = (advancedCurrent?.attendanceTrendByGroup ?? [])
    .map(g => ({ name: g.groupName ?? 'Sin grupo', count: g.trend.reduce((s, d) => s + d.count, 0) }))

  const go = (month: string, v = view) => router.push(`?month=${month}&view=${v}`)
  const nextMonth = shiftMonth(defaultMonth, 1)

  const handleEmail = () => {
    setStatus(null)
    startSending(async () => {
      const res = await emailMonthlyReport(gymSlug, defaultMonth)
      setStatus('error' in res
        ? { ok: false, text: res.error }
        : { ok: true, text: `Reporte enviado a ${res.sentTo}` })
    })
  }

  // Fetch instead of a plain link so a failed generation shows a message instead of saving an error file
  const handleDownload = async () => {
    setStatus(null)
    setDownloading(true)
    try {
      const res = await fetch(`/gym/${gymSlug}/reports/pdf?month=${defaultMonth}`)
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setStatus({ ok: false, text: body.error ?? 'No se pudo generar el PDF' })
        return
      }
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-${gymSlug}-${defaultMonth}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setStatus({ ok: false, text: 'Error de conexión al descargar el PDF' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <AdminPage>
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="font-admin-mono text-xs uppercase tracking-[0.08em] text-adm-muted">Reportes</p>
          <h1 className="text-[34px] font-black capitalize leading-none tracking-tight">{monthStr}</h1>
          <p className="text-sm text-adm-muted">
            {monthly ? <>Comparado con <span className="capitalize">{prevMonthStr}</span></> : 'Detalle día por día'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex gap-1 rounded-full border border-adm-line bg-adm-surface p-1" role="group" aria-label="Vista">
            {(['monthly', 'daily'] as const).map(v => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => go(defaultMonth, v)}
                className={cn(
                  'min-h-9 rounded-full px-4 text-[13px] font-semibold transition-colors',
                  view === v ? 'bg-adm-ink text-adm-surface' : 'text-adm-ink hover:bg-adm-chip',
                )}
              >
                {v === 'monthly' ? 'Mensual' : 'Diario'}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-[10px] border border-adm-line bg-adm-surface">
            <button type="button" aria-label="Mes anterior" onClick={() => go(shiftMonth(defaultMonth, -1))} className="flex size-11 items-center justify-center rounded-l-[10px] hover:bg-adm-chip">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <input
              type="month"
              aria-label="Mes"
              value={defaultMonth}
              max={realCurrentMonth}
              onChange={e => { if (e.target.value) go(e.target.value) }}
              className="min-h-11 w-[150px] bg-transparent px-1 text-center text-sm font-semibold focus:outline-none"
            />
            <button
              type="button"
              aria-label="Mes siguiente"
              disabled={nextMonth > realCurrentMonth}
              onClick={() => go(nextMonth)}
              className="flex size-11 items-center justify-center rounded-r-[10px] hover:bg-adm-chip disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          <button type="button" onClick={handleDownload} disabled={downloading} className={btn.primary}>
            {downloading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}
            Descargar PDF
          </button>
          <button
            type="button"
            onClick={() => exportToExcel(advancedCurrent, advancedPrevious, monthStr, prevMonthStr, curRevTotal, prevRevTotal, view)}
            className={cn(btn.line, 'min-h-11')}
          >
            <Download className="size-4" aria-hidden="true" />
            Excel
          </button>
          <button type="button" onClick={handleEmail} disabled={sending} className={cn(btn.line, 'min-h-11')}>
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Mail className="size-4" aria-hidden="true" />}
            Enviar al correo
          </button>
        </div>
      </header>

      <p aria-live="polite" className={cn('-mt-3 text-[13px] font-semibold', !status && 'sr-only', status?.ok ? 'text-adm-ok-fg' : 'text-adm-bad-fg')}>
        {status?.text}
      </p>

      {!advancedCurrent ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-adm-line bg-adm-subtle p-12 text-center">
          <p className="text-sm font-medium text-adm-muted">Sin datos para este período</p>
        </div>
      ) : (
        <>
          {/* Hero: total income + membership revenue chart */}
          <section aria-labelledby="hero-h" className="adm-night flex flex-wrap gap-8 rounded-[20px] bg-adm-night p-7 text-[#f2f2ee]">
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-[18px]">
              <div className="flex flex-col gap-2">
                <h2 id="hero-h" className="font-admin-mono text-xs font-medium uppercase tracking-[0.08em] text-[#a3a39d]">
                  Ingresos totales {monthly ? 'del mes' : 'del período'}
                </h2>
                <p className="text-[44px] font-black leading-none tracking-tight sm:text-[52px]">{fmt(curTotal)}</p>
                {monthly && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <NightDelta n={totalDelta} />
                    <span className="text-[13px] text-[#a3a39d]">{fmt(prevTotal)} en <span className="capitalize">{prevMonthStr}</span></span>
                  </div>
                )}
              </div>

              {curTotal > 0 && (
                <div
                  className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
                  role="img"
                  aria-label={`Membresías ${Math.round(share(curRevTotal))}%, tienda al contado ${Math.round(share(curStoreCash))}%, tienda en crédito ${Math.round(share(curStoreCredit))}%`}
                >
                  <div className="bg-adm-brand" style={{ width: `${share(curRevTotal)}%` }} />
                  <div className="bg-[#f2f2ee]" style={{ width: `${share(curStoreCash)}%` }} />
                  <div className="bg-[#6b6b66]" style={{ width: `${share(curStoreCredit)}%` }} />
                </div>
              )}

              <dl className="flex flex-col">
                {[
                  { label: 'Membresías', value: curRevTotal, swatch: 'bg-adm-brand' },
                  { label: 'Tienda al contado', value: curStoreCash, swatch: 'bg-[#f2f2ee]' },
                  { label: 'Tienda en crédito (por cobrar)', value: curStoreCredit, swatch: 'bg-[#6b6b66]' },
                ].map((row, i) => (
                  <div key={row.label} className={cn('flex items-center justify-between gap-3 py-2.5', i < 2 && 'border-b border-[#2a2a2e]')}>
                    <dt className="flex items-center gap-2 text-sm text-[#d6d6d0]">
                      <span className={cn('size-2.5 rounded-[3px]', row.swatch)} aria-hidden="true" />
                      {row.label}
                    </dt>
                    <dd className="font-admin-mono text-sm font-semibold">{fmt(row.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex min-w-0 flex-[2_1_460px] flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[15px] font-bold">Membresías {monthly ? 'por semana' : 'por día'}</h3>
                <div className="flex gap-4 text-[13px] text-[#a3a39d]">
                  <span className="flex items-center gap-1.5 capitalize"><span className="size-2.5 rounded-[3px] bg-adm-brand" aria-hidden="true" />{monthStr.split(' ')[0]}</span>
                  {monthly && (
                    <span className="flex items-center gap-1.5 capitalize"><span className="size-2.5 rounded-[3px] bg-[#3a3a3d]" aria-hidden="true" />{prevMonthStr.split(' ')[0]}</span>
                  )}
                </div>
              </div>
              <HeroBars cur={advancedCurrent.revenueTrend} prev={monthly ? advancedPrevious?.revenueTrend ?? [] : null} fmt={fmt} />
            </div>
          </section>

          {/* Members KPIs */}
          <section aria-label="Socios" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            <KpiCard
              label="Socios nuevos"
              value={advancedCurrent.newMembers}
              badge={membersDelta !== null && (membersDelta >= 0 ? <GoodBadge>+{membersDelta}%</GoodBadge> : <BadBadge>{membersDelta}%</BadBadge>)}
              foot={monthly && advancedPrevious ? <>{advancedPrevious.newMembers} en <span className="capitalize">{prevMonthStr.split(' ')[0]}</span></> : undefined}
            />
            <KpiCard
              label="Bajas"
              value={advancedCurrent.churned}
              badge={churnDiff !== null && churnDiff !== 0 && (churnDiff < 0 ? <GoodBadge>{-churnDiff} menos</GoodBadge> : <BadBadge>{churnDiff} más</BadBadge>)}
              foot={monthly && advancedPrevious ? <>{advancedPrevious.churned} en <span className="capitalize">{prevMonthStr.split(' ')[0]}</span></> : undefined}
            />
            <KpiCard label="Crecimiento neto" value={net !== null && net > 0 ? `+${net}` : net ?? '—'} foot="nuevos menos bajas" />
            <KpiCard
              tone="warn"
              label="Vencen en 7 días"
              value={advancedCurrent.expiringNext7Days}
              foot={
                <Link href={`/gym/${gymSlug}/memberships?status=ACTIVE`} className="inline-flex min-h-6 items-center gap-1 font-bold hover:underline">
                  Ver membresías <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              }
            />
          </section>

          <div className="flex flex-wrap gap-3">
            {/* Members by plan */}
            <section aria-labelledby="plans-h" className="flex min-w-0 flex-[1_1_400px] flex-col gap-[18px] rounded-2xl border border-adm-line bg-adm-surface p-[22px]">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="plans-h" className="text-base font-extrabold">Membresías activas por plan</h2>
                <span className="font-admin-mono text-[13px] text-adm-muted">{activeTotal} activas</span>
              </div>
              {advancedCurrent.membersByPlan.length === 0 ? (
                <p className="py-6 text-center text-sm text-adm-muted">No hay membresías activas</p>
              ) : (
                <ul className="flex flex-col gap-3.5">
                  {[...advancedCurrent.membersByPlan].sort((a, b) => b.count - a.count).map(p => (
                    <li key={p.planName} className="flex flex-col gap-1.5">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="truncate font-semibold">{p.planName}</span>
                        <span className="shrink-0 font-admin-mono text-adm-muted">{p.count} · {p.percent}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-adm-chip">
                        <div className="h-full rounded-full bg-adm-ink" style={{ width: `${p.percent}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Attendance */}
            <section aria-labelledby="att-h" className="flex min-w-0 flex-[1_1_400px] flex-col gap-[18px] rounded-2xl border border-adm-line bg-adm-surface p-[22px]">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="att-h" className="text-base font-extrabold">Asistencia · últimos 7 días</h2>
                <span className="font-admin-mono text-[13px] text-adm-muted">{attendanceTotal.toLocaleString('es-AR')} check-ins</span>
              </div>
              {attendance.length > 0 && (
                <div>
                  <div className="flex h-[140px] items-end gap-2.5 border-b border-adm-line" role="img" aria-label="Check-ins por día de los últimos 7 días">
                    {attendance.map(d => {
                      const peak = d.count === attendancePeak && d.count > 0
                      return (
                        <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                          <span className={cn('font-admin-mono text-[11px]', peak ? 'font-bold text-adm-ink' : 'text-adm-muted')}>{d.count}</span>
                          <div
                            className={cn('w-full max-w-9 rounded-t-md', peak ? 'border border-b-0 border-adm-night bg-adm-brand' : 'bg-adm-muted/30')}
                            style={{ height: `${Math.max(3, (d.count / Math.max(1, attendancePeak)) * 82)}%` }}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-2 flex gap-2.5" aria-hidden="true">
                    {attendance.map(d => (
                      <span key={d.label} className="min-w-0 flex-1 text-center font-admin-mono text-xs text-adm-muted">{d.label}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2.5">
                <div className="flex flex-[1_1_140px] flex-col gap-1 rounded-xl border border-adm-line-soft bg-adm-subtle px-3.5 py-3">
                  <span className="text-xs font-semibold text-adm-muted">Día con más gente</span>
                  <span className="text-xl font-extrabold capitalize">{advancedCurrent.peakDay ?? '—'}</span>
                </div>
                <div className="flex flex-[1_1_140px] flex-col gap-1 rounded-xl border border-adm-line-soft bg-adm-subtle px-3.5 py-3">
                  <span className="text-xs font-semibold text-adm-muted">Hora pico</span>
                  <span className="text-xl font-extrabold">{advancedCurrent.peakHour ?? '—'}</span>
                </div>
              </div>
              {groups.length > 1 && (
                <ul className="flex flex-col" aria-label="Check-ins por grupo">
                  {groups.map(g => (
                    <li key={g.name} className="flex justify-between gap-3 border-t border-adm-line-soft py-2.5 text-sm">
                      <span className="truncate font-semibold">{g.name}</span>
                      <span className="font-admin-mono text-adm-muted">{g.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </AdminPage>
  )
}
