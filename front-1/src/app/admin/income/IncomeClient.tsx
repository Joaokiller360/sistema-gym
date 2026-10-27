'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { registerSubscriptionPaymentAction } from '../gyms/actions'
import {
  METHOD_LABELS,
  daysUntil,
  dedupeBilling,
  fmtAmount,
  fmtMoney,
  planPrice,
  type GymWithBilling,
  type Money,
  type SubscriptionPlanPrice,
} from '@/lib/admin-billing'
import { EmptyState, GymMark, Meter, PageHeader, Panel, Pill, Stat, btn, chip, field, td, th, type Tone } from '@/components/admin/ui'

const METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'OTHER', label: 'Otro' },
] as const

type Method = (typeof METHODS)[number]['value']
type Period = 'month' | 'prev' | 'all'

const TX_PAGE = 15

interface Stats {
  monthly: Money | null
  monthDelta: number | null
  daily: Money | null
  dailyCount: number
  dueSoon: Money | null
  dueSoonCount: number
  overdue: Money | null
  overdueCount: number
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

function monthToNote(ym: string) {
  const [y, m] = ym.split('-')
  const name = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-AR', { month: 'long' })
  return `Pago mensual ${name} ${y}`
}

function PaymentDialog({
  gyms,
  subPlans,
  initialGymId,
  open,
  onClose,
}: {
  gyms: GymWithBilling[]
  subPlans: SubscriptionPlanPrice[]
  initialGymId: string | null
  open: boolean
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [gymId, setGymId] = useState(initialGymId ?? '')
  const [method, setMethod] = useState<Method>('CASH')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const gym = gyms.find(g => g.id === gymId)
  const price = gym ? planPrice(subPlans, gym.subscription?.subscriptionPlan ?? gym.subscriptionPlan) : null

  function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!gym) return
    if (!price) {
      toast.error('No se puede registrar un pago de $0. Revisá el precio del plan de suscripción.')
      return
    }
    startTransition(async () => {
      const res = await registerSubscriptionPaymentAction(gym.id, {
        amount: price.amount,
        currency: price.currency as 'USD' | 'ARS' | 'EUR',
        method,
        notes: monthToNote(month),
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Pago registrado y suscripción renovada.')
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="admin-surface sm:max-w-md" showCloseButton>
        <DialogTitle className="text-lg font-extrabold">Registrar pago</DialogTitle>
        <DialogDescription>Renueva la suscripción del gimnasio por el período elegido.</DialogDescription>
        <form onSubmit={handlePay} className="mt-2 flex flex-col gap-4">
          <label className="block">
            <span className={field.label}>Gimnasio</span>
            <select value={gymId} onChange={e => setGymId(e.target.value)} disabled={isPending} className={field.input} required>
              <option value="" disabled>Elegí un gimnasio</option>
              {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between rounded-[10px] border border-adm-line bg-adm-subtle px-4 py-3">
            <span className="text-[13px] font-semibold text-adm-muted">Monto a cobrar</span>
            <span className="font-admin-mono text-base font-bold">{gym ? fmtMoney(price, { decimals: true }) : '—'}</span>
          </div>
          <div>
            <span className={field.label} id="pd-method">Método de pago</span>
            <div role="radiogroup" aria-labelledby="pd-method" className="flex flex-wrap gap-2">
              {METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={method === m.value}
                  onClick={() => setMethod(m.value)}
                  disabled={isPending}
                  className={cn(
                    'min-h-10 rounded-lg border px-3.5 text-[13px] font-semibold transition-colors',
                    method === m.value ? 'border-adm-ink bg-adm-ink text-adm-surface' : 'border-adm-line bg-adm-surface hover:border-adm-ink',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={field.label}>Mes</span>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} disabled={isPending} className={field.input} />
            <span className={field.hint}>{monthToNote(month)}</span>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={isPending || !gym} className={cn(btn.dark, 'min-h-11 flex-1')}>
              {isPending ? 'Registrando…' : 'Confirmar pago'}
            </button>
            <button type="button" onClick={onClose} className={cn(btn.line, 'min-h-11')}>Cancelar</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function IncomeClient({
  gyms,
  subPlans,
  stats,
  monthName,
  prevMonthName,
}: {
  gyms: GymWithBilling[]
  subPlans: SubscriptionPlanPrice[]
  stats: Stats
  monthName: string
  prevMonthName: string
}) {
  const [payFor, setPayFor] = useState<{ open: boolean; gymId: string | null; key: number }>({ open: false, gymId: null, key: 0 })
  const openPay = (gymId: string | null) => setPayFor(p => ({ open: true, gymId, key: p.key + 1 }))

  const [period, setPeriod] = useState<Period>('month')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const planLabel = (key: string | undefined | null) =>
    subPlans.find(p => p.key.toUpperCase() === key?.toUpperCase())?.label ?? key ?? '—'

  // Upcoming / overdue collections
  const due = useMemo(() => {
    return gyms
      .filter(g => g.subscription?.subscriptionExpiresAt)
      .map(g => {
        const s = g.subscription!
        const days = daysUntil(s.subscriptionExpiresAt!)
        const late = s.subscriptionStatus !== 'ACTIVE'
        const tone: Tone = late ? 'bad' : days <= 7 ? 'warn' : 'neutral'
        const when = late
          ? s.subscriptionStatus === 'GRACE' ? 'Vencido · prórroga' : 'Suspendido'
          : days === 0 ? 'Vence hoy' : `En ${days} día${days !== 1 ? 's' : ''}`
        return { gym: g, days, late, tone, when, price: planPrice(subPlans, s.subscriptionPlan) }
      })
      .filter(d => d.late || d.days <= 30)
      .sort((a, b) => (a.late === b.late ? a.days - b.days : a.late ? -1 : 1))
  }, [gyms, subPlans])

  // All transactions, flattened
  const transactions = useMemo(() => {
    return gyms
      .flatMap(g => g.billing.map(b => ({ ...b, gym: g })))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [gyms])

  const now = new Date()
  const range: Record<Period, [Date, Date] | null> = {
    month: [new Date(now.getFullYear(), now.getMonth(), 1), now],
    prev: [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)],
    all: null,
  }
  const r = range[period]
  const q = query.trim().toLowerCase()
  const filteredTx = transactions.filter(t => {
    if (r) {
      const d = new Date(t.createdAt)
      if (d < r[0] || d > r[1]) return false
    }
    return !q || t.gym.name.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q)
  })
  const totalPages = Math.max(1, Math.ceil(filteredTx.length / TX_PAGE))
  const currentPage = Math.min(page, totalPages)
  const pageTx = filteredTx.slice((currentPage - 1) * TX_PAGE, currentPage * TX_PAGE)

  // Revenue by method for the selected period (deduped per gym)
  const byMethod = (() => {
    const totals: Record<string, Record<string, number>> = {}
    for (const g of gyms) {
      const recs = dedupeBilling(g.billing.filter(b => {
        if (!r) return true
        const d = new Date(b.createdAt)
        return d >= r[0] && d <= r[1]
      }))
      for (const b of recs) {
        const m = b.method ?? 'OTHER'
        totals[b.currency] ??= {}
        totals[b.currency][m] = (totals[b.currency][m] ?? 0) + (parseFloat(b.amount) || 0)
      }
    }
    const [currency, perMethod] = Object.entries(totals).sort(
      (a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0),
    )[0] ?? ['', {}]
    const total = Object.values(perMethod).reduce((x, y) => x + y, 0)
    return {
      currency,
      total,
      rows: Object.entries(perMethod)
        .map(([m, amount]) => ({ method: m, amount, pct: total ? (amount / total) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount),
    }
  })()

  const periodTotal = (() => {
    const byCur: Record<string, number> = {}
    for (const t of filteredTx) byCur[t.currency] = (byCur[t.currency] ?? 0) + (parseFloat(t.amount) || 0)
    return Object.entries(byCur).sort((a, b) => b[1] - a[1])[0]
  })()

  function exportCsv() {
    const header = ['Fecha', 'Gimnasio', 'Plan', 'Periodo desde', 'Periodo hasta', 'Metodo', 'Nota', 'Moneda', 'Monto']
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const lines = filteredTx.map(t => [
      fmtDate(t.createdAt),
      t.gym.name,
      planLabel(t.gym.subscription?.subscriptionPlan ?? t.gym.subscriptionPlan),
      t.periodStart ? fmtDate(t.periodStart) : '',
      t.periodEnd ? fmtDate(t.periodEnd) : '',
      t.method ? (METHOD_LABELS[t.method] ?? t.method) : '',
      t.notes ?? '',
      t.currency,
      String(parseFloat(t.amount)),
    ].map(esc).join(','))
    const blob = new Blob(['﻿' + [header.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ingresos-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'month', label: 'Este mes' },
    { key: 'prev', label: 'Mes anterior' },
    { key: 'all', label: 'Todo' },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Control de suscripciones y pagos de gimnasios"
        title="Ingresos"
        actions={
          <>
            <button type="button" onClick={exportCsv} disabled={filteredTx.length === 0} className={cn(btn.line, 'min-h-11 text-sm')}>
              <Download className="size-4" aria-hidden="true" />
              Exportar CSV
            </button>
            <button type="button" onClick={() => openPay(null)} className={btn.primary}>
              <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
              Registrar pago
            </button>
          </>
        }
      />

      <section aria-label="Indicadores" className="flex flex-wrap gap-3">
        <div className="flex-[1.4_1_260px] rounded-2xl bg-adm-night p-5 text-white">
          <div className="text-[13px] font-semibold capitalize text-[#a3a39d]">Cobrado en {monthName}</div>
          <div className="mt-2.5 font-admin-mono text-[38px] font-bold leading-tight tracking-tight">
            {stats.monthly && <span className="mr-1.5 text-base font-medium text-[#a3a39d]">{stats.monthly.currency}</span>}
            {stats.monthly ? fmtAmount(stats.monthly.amount) : '—'}
          </div>
          {stats.monthDelta !== null && (
            <div className={cn('mt-2 text-[13px] font-semibold', stats.monthDelta >= 0 ? 'text-adm-brand' : 'text-[#ff8a80]')}>
              {stats.monthDelta >= 0 ? '+' : ''}{stats.monthDelta.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% vs. mismo período de {prevMonthName}
            </div>
          )}
        </div>
        <Stat
          label="Cobrado hoy"
          unit={stats.daily?.currency}
          value={stats.daily ? fmtAmount(stats.daily.amount) : '—'}
          hint={`${stats.dailyCount} pago${stats.dailyCount !== 1 ? 's' : ''}`}
        />
        <Stat
          label="Por cobrar · 7 días"
          unit={stats.dueSoon?.currency}
          value={stats.dueSoon ? fmtAmount(stats.dueSoon.amount) : '—'}
          hint={`${stats.dueSoonCount} gimnasio${stats.dueSoonCount !== 1 ? 's' : ''}`}
          hintTone={stats.dueSoonCount > 0 ? 'warn' : 'neutral'}
        />
        <Stat
          label="Vencido"
          unit={stats.overdue?.currency}
          value={stats.overdue ? fmtAmount(stats.overdue.amount) : '—'}
          hint={`${stats.overdueCount} en prórroga o suspendido${stats.overdueCount !== 1 ? 's' : ''}`}
          hintTone={stats.overdueCount > 0 ? 'bad' : 'neutral'}
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <Panel
          title="Próximos cobros"
          id="due-h"
          action={<span className="text-[13px] text-adm-muted">Próximos 30 días y vencidos</span>}
          className="min-w-0 flex-[1.6_1_420px]"
        >
          {due.length === 0 ? (
            <EmptyState>No hay cobros pendientes en los próximos 30 días.</EmptyState>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {due.map(d => (
                <li key={d.gym.id} className="flex flex-wrap items-center gap-3 border-t border-adm-line-soft px-5 py-3 first:border-t-0">
                  <GymMark name={d.gym.name} logoUrl={d.gym.logoUrl} />
                  <div className="min-w-0 flex-[1_1_160px]">
                    <p className="truncate text-sm font-bold">{d.gym.name}</p>
                    <p className="text-xs text-adm-muted">
                      {planLabel(d.gym.subscription?.subscriptionPlan)} · vence {fmtShort(d.gym.subscription!.subscriptionExpiresAt!)}
                    </p>
                  </div>
                  <Pill tone={d.tone}>{d.when}</Pill>
                  <span className="min-w-24 text-right font-admin-mono text-sm font-bold">{fmtMoney(d.price)}</span>
                  <button type="button" onClick={() => openPay(d.gym.id)} className={btn.dark}>Registrar</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={`Por método · ${PERIODS.find(p => p.key === period)!.label.toLowerCase()}`}
          id="met-h"
          className="min-w-0 flex-[1_1_280px]"
          bodyClassName="flex flex-col gap-4 p-5"
        >
          {byMethod.rows.length === 0 ? (
            <p className="text-sm text-adm-muted">Sin pagos en el período.</p>
          ) : (
            byMethod.rows.map(m => (
              <div key={m.method} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-2 text-[13px]">
                  <span className="font-semibold">{METHOD_LABELS[m.method] ?? m.method}</span>
                  <span className="font-admin-mono text-adm-muted">{fmtAmount(m.amount)} · {Math.round(m.pct)}%</span>
                </div>
                <Meter value={m.pct} className="h-2.5" />
              </div>
            ))
          )}
          {byMethod.total > 0 && (
            <p className="mt-auto border-t border-adm-line-soft pt-3 text-[13px] text-adm-muted">
              Total <strong className="font-admin-mono text-adm-ink">{byMethod.currency} {fmtAmount(byMethod.total)}</strong>
            </p>
          )}
        </Panel>
      </div>

      <Panel
        title="Transacciones"
        id="tx-h"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Período" className="flex flex-wrap gap-1.5">
              {PERIODS.map(p => (
                <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => { setPeriod(p.key); setPage(1) }} className={chip(period === p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
            <label className="relative flex w-60 max-w-full items-center">
              <span className="sr-only">Buscar transacción</span>
              <Search className="pointer-events-none absolute left-3 size-4 text-adm-muted" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={e => { setQuery(e.target.value); setPage(1) }}
                placeholder="Gimnasio o nota"
                className={cn(field.input, 'min-h-10 pl-9')}
              />
            </label>
          </div>
        }
      >
        {pageTx.length === 0 ? (
          <EmptyState>Sin transacciones en el período.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className={cn(th, 'pl-5')}>Fecha</th>
                  <th scope="col" className={th}>Gimnasio</th>
                  <th scope="col" className={th}>Plan</th>
                  <th scope="col" className={th}>Período</th>
                  <th scope="col" className={th}>Método</th>
                  <th scope="col" className={th}>Nota</th>
                  <th scope="col" className={cn(th, 'pr-5 text-right')}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {pageTx.map(t => (
                  <tr key={t.id} className="hover:bg-adm-subtle">
                    <td className={cn(td, 'pl-5 font-admin-mono text-[13px]')}>{fmtDate(t.createdAt)}</td>
                    <td className={cn(td, 'font-bold')}>{t.gym.name}</td>
                    <td className={td}>{planLabel(t.gym.subscription?.subscriptionPlan ?? t.gym.subscriptionPlan)}</td>
                    <td className={cn(td, 'text-[13px] text-adm-muted')}>
                      {t.periodStart && t.periodEnd ? `${fmtShort(t.periodStart)} → ${fmtShort(t.periodEnd)}` : '—'}
                    </td>
                    <td className={td}><Pill>{t.method ? (METHOD_LABELS[t.method] ?? t.method) : '—'}</Pill></td>
                    <td className={cn(td, 'max-w-[220px] truncate text-adm-muted')}>{t.notes ?? '—'}</td>
                    <td className={cn(td, 'pr-5 text-right font-admin-mono font-bold')}>{fmtMoney({ amount: parseFloat(t.amount), currency: t.currency }, { decimals: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-line-soft px-5 py-3.5 text-[13px] text-adm-muted">
          <span>
            {pageTx.length} de {filteredTx.length} transacciones
            {periodTotal && <> · Total <strong className="font-admin-mono text-adm-ink">{periodTotal[0]} {fmtAmount(periodTotal[1])}</strong></>}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className={btn.line}>
                <ChevronLeft className="size-4" aria-hidden="true" /> Anterior
              </button>
              <span className="px-2 font-admin-mono">{currentPage} / {totalPages}</span>
              <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages} className={btn.line}>
                Siguiente <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </Panel>

      <PaymentDialog
        key={payFor.key}
        gyms={gyms}
        subPlans={subPlans}
        initialGymId={payFor.gymId}
        open={payFor.open}
        onClose={() => setPayFor(p => ({ ...p, open: false }))}
      />
    </>
  )
}
