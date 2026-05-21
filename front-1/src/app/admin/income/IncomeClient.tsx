'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, CheckCircle2, AlertTriangle, Ban, ChevronDown, ChevronUp, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { registerSubscriptionPaymentAction } from '../gyms/actions'
import type { Gym } from '@/types'

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

interface GymRevenue {
  amount: number
  currency: string
}

interface BillingRecord {
  id: string
  amount: string
  currency: string
  method?: string
  notes?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  createdAt: string
}

interface GymWithSubscription extends Gym {
  subscription?: SubscriptionInfo | null
  dailyRevenue?: GymRevenue | null
  monthlyRevenue?: GymRevenue | null
  billing: BillingRecord[]
}

const METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
] as const

function StatusBadge({ status }: { status: SubscriptionInfo['subscriptionStatus'] }) {
  if (status === 'ACTIVE') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-[#1fad9d]/15 text-[#0e7a70] border border-[#1fad9d]/30">
      <CheckCircle2 className="h-3 w-3" /> Activa
    </span>
  )
  if (status === 'GRACE') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <AlertTriangle className="h-3 w-3" /> Prórroga
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
      <Ban className="h-3 w-3" /> Suspendida
    </span>
  )
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function GymPayRow({
  gym,
  subPlans,
}: {
  gym: GymWithSubscription
  subPlans: SubscriptionPlan[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [showTx, setShowTx] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [method, setMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH')
  const todayYM = new Date().toISOString().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(todayYM)

  const matchedPlan = gym.subscription
    ? subPlans.find(p => p.key.toUpperCase() === gym.subscription!.subscriptionPlan?.toUpperCase())
    : null
  const planAmount = matchedPlan ? parseFloat(String(matchedPlan.price)) : null
  const planCurrency = matchedPlan?.currency ?? 'USD'

  function monthToNote(ym: string) {
    const [y, m] = ym.split('-')
    const name = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-AR', { month: 'long' })
    return `Pago mensual ${name} ${y}`
  }

  function handlePay(e: React.FormEvent) {
    e.preventDefault()
        if (!planAmount || planAmount <= 0) {
      toast.error('No se puede registrar un pago de $0. Revisá el precio del plan de suscripción.')
      return
    }

    startTransition(async () => {
      const res = await registerSubscriptionPaymentAction(gym.id, {
        amount: planAmount,
        currency: planCurrency as 'USD' | 'ARS' | 'EUR',
        method,
        notes: monthToNote(selectedMonth),
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Pago registrado y suscripción renovada.')
        setShowForm(false)
        router.refresh()
      }
    })
  }

  return (
    <div className={`rounded-2xl border bg-white overflow-hidden ${gym.subscription?.subscriptionStatus === 'SUSPENDED' ? 'border-red-200' : gym.subscription?.subscriptionStatus === 'GRACE' ? 'border-amber-200' : 'border-zinc-200'}`}>
      {/* Gym header row */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
            {gym.logoUrl
              ? <img src={gym.logoUrl} alt={gym.name} className="h-full w-full object-cover" />
              : <span className="text-xs font-black text-black">{gym.name.slice(0, 2).toUpperCase()}</span>
            }
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{gym.name}</p>
            <p className="text-xs text-zinc-400">{gym.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {gym.subscription && <StatusBadge status={gym.subscription.subscriptionStatus} />}
          {gym.subscription?.subscriptionExpiresAt && (
            <span className="text-xs text-zinc-400 hidden sm:block">
              Vence {fmt(gym.subscription.subscriptionExpiresAt)}
            </span>
          )}
        </div>
      </div>

      {/* Stats + action row */}
      <div className="flex items-center justify-between px-5 pb-4 gap-3 border-t border-zinc-50">
        <div className="flex items-center gap-4 pt-3">
          {/* Plan price */}
          {planAmount && (
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Plan</span>
              <span className="text-sm font-bold text-zinc-700">
                {planCurrency} {planAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {/* Daily revenue */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Hoy</span>
            <span className="text-sm font-bold text-zinc-700">
              {gym.dailyRevenue
                ? `${gym.dailyRevenue.currency} ${gym.dailyRevenue.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                : <span className="text-zinc-300">—</span>
              }
            </span>
          </div>
          {/* Monthly revenue */}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Este mes</span>
            <span className="text-sm font-bold text-[#0e7a70]">
              {gym.monthlyRevenue
                ? `${gym.monthlyRevenue.currency} ${gym.monthlyRevenue.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                : <span className="text-zinc-300">—</span>
              }
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowTx(v => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:border-zinc-400 transition-all"
          >
            <Receipt className="h-3.5 w-3.5" />
            {gym.billing.length}
            {showTx ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-black px-3 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 transition-all"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Registrar pago
            {showForm ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Transactions list */}
      {showTx && (
        <div className="border-t border-zinc-100 bg-zinc-50/50">
          {gym.billing.length === 0 ? (
            <p className="px-5 py-4 text-xs text-zinc-400">Sin transacciones</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left px-5 py-2 font-bold uppercase tracking-widest text-zinc-400">Fecha</th>
                  <th className="text-left px-5 py-2 font-bold uppercase tracking-widest text-zinc-400">Monto</th>
                  <th className="text-left px-5 py-2 font-bold uppercase tracking-widest text-zinc-400 hidden sm:table-cell">Método</th>
                  <th className="text-left px-5 py-2 font-bold uppercase tracking-widest text-zinc-400 hidden md:table-cell">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {[...gym.billing].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(tx => (
                  <tr key={tx.id} className="hover:bg-zinc-100/50">
                    <td className="px-5 py-2.5 text-zinc-500 whitespace-nowrap">{fmtDate(tx.createdAt)}</td>
                    <td className="px-5 py-2.5 font-bold text-zinc-800 whitespace-nowrap">
                      {tx.currency} {parseFloat(tx.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-2.5 text-zinc-500 hidden sm:table-cell">
                      {tx.method ? (METHOD_LABELS[tx.method] ?? tx.method) : '—'}
                    </td>
                    <td className="px-5 py-2.5 text-zinc-400 hidden md:table-cell max-w-[200px] truncate">
                      {tx.notes ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Payment form */}
      {showForm && (
        <form onSubmit={handlePay} className="border-t border-zinc-100 px-5 py-4 space-y-4 bg-zinc-50/50">
          {/* Amount */}
          <div className="rounded-xl bg-white border border-zinc-200 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Monto a cobrar</span>
            <span className="text-sm font-bold">
              {planAmount != null
                ? `${planCurrency} ${planAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                : <span className="text-zinc-400">—</span>
              }
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Method */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Método</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as typeof method)}
                disabled={isPending}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all disabled:opacity-50"
              >
                {METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Month */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Mes</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                disabled={isPending}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <p className="text-xs text-zinc-400">{monthToNote(selectedMonth)}</p>


          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-black px-5 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
            >
              {isPending ? 'Registrando…' : 'Confirmar pago'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export function IncomeClient({
  gyms,
  subPlans,
}: {
  gyms: GymWithSubscription[]
  subPlans: SubscriptionPlan[]
}) {
  const [filter, setFilter] = useState<'all' | 'ACTIVE' | 'GRACE' | 'SUSPENDED'>('all')

  const filtered = filter === 'all'
    ? gyms
    : gyms.filter(g => g.subscription?.subscriptionStatus === filter)

  const FILTERS = [
    { value: 'all', label: 'Todos' },
    { value: 'ACTIVE', label: 'Activos' },
    { value: 'GRACE', label: 'Prórroga' },
    { value: 'SUSPENDED', label: 'Suspendidos' },
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Gimnasios</h2>
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'border-black bg-black text-white'
                  : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-400 py-8 text-center">Sin resultados</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(g => (
            <GymPayRow key={g.id} gym={g} subPlans={subPlans} />
          ))}
        </div>
      )}
    </div>
  )
}
