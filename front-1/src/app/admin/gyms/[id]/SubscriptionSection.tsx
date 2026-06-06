'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CreditCard, AlertTriangle, Ban, CheckCircle2, ChevronDown, ChevronUp, Trash2, ArrowRightLeft, X } from 'lucide-react'
import { registerSubscriptionPaymentAction, deleteSubscriptionPaymentAction, changeGymPlanAction, type SubscriptionInfo, type BillingRecord, type PaymentInput, type ProratedResult } from '../actions'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'
const selectClass = inputClass

function StatusBadgeSubscription({ status }: { status: SubscriptionInfo['subscriptionStatus'] }) {
  if (status === 'ACTIVE') return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#1fad9d]/15 text-[#0e7a70] border border-[#1fad9d]/30">
      <CheckCircle2 className="h-3 w-3" /> Activa
    </span>
  )
  if (status === 'GRACE') return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <AlertTriangle className="h-3 w-3" /> Prórroga
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
      <Ban className="h-3 w-3" /> Suspendida
    </span>
  )
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMethod(m: string) {
  return { CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', OTHER: 'Otro' }[m] ?? m
}

interface SubscriptionPlan {
  id?: string
  key: string
  label?: string
  price: number | string
  currency: string
}

function fmtMoney(n: number, currency = 'USD') {
  return `${currency} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

function ProratedBreakdown({ p, currency, onDone }: { p: ProratedResult; currency: string; onDone: () => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-[#1fad9d]/8 border border-[#1fad9d]/20 p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-[#0e7a70]">Detalle de prorrateo</p>
        <div className="space-y-1">
          {([
            ['Días consumidos', `${p.daysConsumed} días`],
            ['Días restantes', `${p.daysRemaining} días`],
            ['Tarifa diaria', fmtMoney(p.dailyRate, currency)],
            ['Crédito a favor', fmtMoney(p.creditAmount/100, currency)],
            ['Precio nuevo plan', fmtMoney(p.newPlanPrice/100, currency)],
            ['Crédito aplicado', `- ${fmtMoney(p.creditApplied/100, currency)}`],
          ] as const).map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-zinc-500">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-[#1fad9d]/20 pt-2 flex justify-between font-black text-base">
          <span>Total cobrado</span>
          <span className="text-[#0e7a70]">{fmtMoney(p.amountDue/100, currency)}</span>
        </div>
      </div>
      <button type="button" onClick={onDone} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-black transition-colors">
        <CheckCircle2 className="h-3.5 w-3.5 text-[#1fad9d]" /> Listo
      </button>
    </div>
  )
}

export function SubscriptionSection({
  gymId,
  gymSlug,
  subscription,
  billing,
  planAmount,
  planCurrency,
  subPlans,
}: {
  gymId: string
  gymSlug: string
  subscription: SubscriptionInfo
  billing: BillingRecord[]
  planAmount: number | null
  planCurrency: string
  subPlans: SubscriptionPlan[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPendingDelete, startDeleteTransition] = useTransition()
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [selectedPlanKey, setSelectedPlanKey] = useState('')
  const [changePlanMethod, setChangePlanMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH')
  const [changePlanNotes, setChangePlanNotes] = useState('')
  const [changePlanProration, setChangePlanProration] = useState<ProratedResult | null>(null)
  const [isPendingChangePlan, startChangePlanTransition] = useTransition()

  const availableSubPlans = subPlans.filter(p => p.key.toUpperCase() !== subscription.subscriptionPlan?.toUpperCase())

  const [method, setMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH')

  const todayYM = new Date().toISOString().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(todayYM)

  function monthToNote(ym: string) {
    const [y, m] = ym.split('-')
    const name = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-AR', { month: 'long' })
    return `Pago mensual ${name} ${y}`
  }

  function confirmDeleteBilling() {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setConfirmDeleteId(null)
    setDeletingId(id)
    startDeleteTransition(async () => {
      const res = await deleteSubscriptionPaymentAction(gymId, id)
      setDeletingId(null)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Pago eliminado. Estado de suscripción actualizado.')
        router.refresh()
      }
    })
  }

  function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!planAmount || planAmount <= 0) { toast.error('No se encontró el precio del plan'); return }

    startTransition(async () => {
      const data: PaymentInput = {
        amount: planAmount,
        currency: planCurrency as 'USD' | 'ARS' | 'EUR',
        method,
        notes: monthToNote(selectedMonth),
      }
      const res = await registerSubscriptionPaymentAction(gymId, data)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Pago registrado y suscripción renovada.')
        setShowForm(false)
        router.refresh()
      }
    })
  }

  function handleChangePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlanKey) return
    startChangePlanTransition(async () => {
      const res = await changeGymPlanAction(gymId, {
        planKey: selectedPlanKey,
        method: changePlanMethod,
        notes: changePlanNotes.trim() || undefined,
      }, gymSlug)
      if (res.error) {
        toast.error(res.error)
      } else {
        setChangePlanProration(res.proration ?? null)
        toast.success('Plan de suscripción cambiado correctamente')
        router.refresh()
      }
    })
  }

  const isWarning = subscription.subscriptionStatus === 'GRACE'
  const isSuspended = subscription.subscriptionStatus === 'SUSPENDED'

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className={`rounded-2xl border bg-white overflow-hidden ${isSuspended ? 'border-red-200' : isWarning ? 'border-amber-200' : 'border-zinc-200'}`}>
        <div className={`px-5 py-3 border-b flex items-center justify-between ${isSuspended ? 'bg-red-50 border-red-100' : isWarning ? 'bg-amber-50 border-amber-100' : 'bg-zinc-50 border-zinc-100'}`}>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-zinc-400" />
            <span className="text-sm font-semibold">Suscripción</span>
          </div>
          <StatusBadgeSubscription status={subscription.subscriptionStatus} />
        </div>

        <div className="divide-y divide-zinc-100">
          <div className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-zinc-500">Plan</span>
            <span className="font-semibold">{subscription.subscriptionPlan}</span>
          </div>
          {subscription.subscriptionExpiresAt && (
            <div className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-zinc-500">Vence</span>
              <span className={`font-semibold ${isSuspended ? 'text-red-600' : isWarning ? 'text-amber-600' : ''}`}>
                {fmt(subscription.subscriptionExpiresAt)}
                {subscription.daysUntilExpiry !== null && subscription.daysUntilExpiry > 0 && (
                  <span className="ml-1.5 text-xs text-zinc-400">({subscription.daysUntilExpiry}d restantes)</span>
                )}
              </span>
            </div>
          )}
          {isWarning && subscription.subscriptionGraceEndsAt && (
            <div className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-zinc-500">Prórroga hasta</span>
              <span className="font-semibold text-amber-600">{fmt(subscription.subscriptionGraceEndsAt)}</span>
            </div>
          )}
        </div>

        {/* Warning banners */}
        {isWarning && (
          <div className="mx-4 mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 font-medium">
            El plan venció. El gym tiene acceso en prórroga hasta el {subscription.subscriptionGraceEndsAt ? fmt(subscription.subscriptionGraceEndsAt) : '—'}. Registrá un pago para renovar.
          </div>
        )}
        {isSuspended && (
          <div className="mx-4 mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600 font-medium">
            Suscripción suspendida. El gym no tiene acceso al sistema. Registrá un pago para reactivar.
          </div>
        )}
      </div>

      {/* Payment form */}
      {showForm ? (
        <form onSubmit={handlePay} className="rounded-2xl border-2 border-zinc-200 bg-white p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Registrar pago</p>

          {/* Auto amount display */}
          <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Monto a cobrar</span>
            <span className="text-sm font-bold">
              {planAmount != null
                ? `${planCurrency} ${planAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                : <span className="text-zinc-400">—</span>
              }
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Método de pago</label>
            <select value={method} onChange={e => setMethod(e.target.value as typeof method)} disabled={isPending} className={selectClass}>
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="TRANSFER">Transferencia</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Mes</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              disabled={isPending}
              className={inputClass}
            />
            <p className="text-xs text-zinc-400">{monthToNote(selectedMonth)}</p>
          </div>


          <div className="flex gap-3">
            <button type="submit" disabled={isPending} className="rounded-xl bg-black px-5 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
              {isPending ? 'Registrando…' : 'Confirmar pago'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-all"
        >
          <CreditCard className="h-4 w-4" />
          Registrar pago
        </button>
      )}

      {/* Change plan */}
      {changePlanProration ? (
        <ProratedBreakdown
          p={changePlanProration}
          currency={subPlans.find(p => p.key.toUpperCase() === selectedPlanKey.toUpperCase())?.currency ?? 'USD'}
          onDone={() => { setChangePlanProration(null); setShowChangePlan(false); setSelectedPlanKey('') }}
        />
      ) : showChangePlan ? (
        <form onSubmit={handleChangePlan} className="rounded-2xl border-2 border-zinc-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Cambiar plan de suscripción</p>
            <button type="button" onClick={() => setShowChangePlan(false)} className="text-zinc-400 hover:text-zinc-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            {availableSubPlans.length === 0 ? (
              <p className="text-sm text-zinc-400">No hay otros planes disponibles.</p>
            ) : availableSubPlans.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelectedPlanKey(p.key)}
                className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  selectedPlanKey === p.key ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <span className="text-sm font-semibold">{p.label ?? p.key}</span>
                <span className="text-sm font-bold">{p.currency} {parseFloat(String(p.price)).toLocaleString('es-AR')}</span>
              </button>
            ))}
          </div>

          {availableSubPlans.length > 0 && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Método</label>
                <select
                  value={changePlanMethod}
                  onChange={e => setChangePlanMethod(e.target.value as typeof changePlanMethod)}
                  disabled={isPendingChangePlan}
                  className={inputClass}
                >
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Notas (opcional)</label>
                <input
                  type="text"
                  value={changePlanNotes}
                  onChange={e => setChangePlanNotes(e.target.value)}
                  placeholder="Ej. Upgrade manual a Pro"
                  disabled={isPendingChangePlan}
                  className={inputClass}
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={isPendingChangePlan || !selectedPlanKey} className="rounded-xl bg-black px-5 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
                  {isPendingChangePlan ? 'Cambiando…' : 'Confirmar cambio'}
                </button>
                <button type="button" onClick={() => setShowChangePlan(false)} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
                  Cancelar
                </button>
              </div>
            </>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowChangePlan(true)}
          className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-500 hover:border-black hover:text-black transition-all w-full justify-center"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Cambiar plan de suscripción
        </button>
      )}

      {/* Billing history */}
      {billing.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold hover:bg-zinc-50 transition-colors"
          >
            Historial de pagos ({billing.length})
            {showHistory ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
          </button>

          {showHistory && (
            <div className="border-t border-zinc-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Fecha</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Monto</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden md:table-cell">Método</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Período</th>
                    <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Notas</th>
                    <th className="px-3 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {billing.map(b => (
                    <tr key={b.id} className={`hover:bg-zinc-50 transition-colors ${deletingId === b.id ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3 text-zinc-500">{fmt(b.createdAt)}</td>
                      <td className="px-5 py-3 font-semibold">{b.currency} {parseFloat(b.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-5 py-3 text-zinc-500 hidden md:table-cell">{fmtMethod(b.method)}</td>
                      <td className="px-5 py-3 text-zinc-500 hidden lg:table-cell">{fmt(b.periodStart)} → {fmt(b.periodEnd)}</td>
                      <td className="px-5 py-3 text-zinc-400 hidden lg:table-cell">{b.notes ?? '—'}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(b.id)}
                          disabled={isPendingDelete}
                          className="p-1.5 rounded-lg text-zinc-300 hover:text-[#ff0000] hover:bg-red-50 transition-colors disabled:opacity-40"
                          title="Eliminar pago"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => { if (!open) setConfirmDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pago</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que querés eliminar este pago? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBilling}
              className="bg-[#ff0000] hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
