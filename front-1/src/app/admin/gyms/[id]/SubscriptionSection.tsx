'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, ArrowRightLeft, X } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { EmptyState, Panel, Pill, btn, field, td, th, type Tone } from '@/components/admin/ui'

const STATUS: Record<SubscriptionInfo['subscriptionStatus'], { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Activa', tone: 'ok' },
  GRACE: { label: 'Prórroga', tone: 'warn' },
  SUSPENDED: { label: 'Suspendida', tone: 'bad' },
}

const METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'OTHER', label: 'Otro' },
] as const

type Method = (typeof METHODS)[number]['value']

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMethod(m: string) {
  return METHODS.find(x => x.value === m)?.label ?? m
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

function MethodPicker({ value, onChange, disabled }: { value: Method; onChange: (m: Method) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Método de pago" className="flex flex-wrap gap-2">
      {METHODS.map(m => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          disabled={disabled}
          onClick={() => onChange(m.value)}
          className={cn(
            'min-h-10 rounded-lg border px-3.5 text-[13px] font-semibold transition-colors',
            value === m.value ? 'border-adm-ink bg-adm-ink text-adm-surface' : 'border-adm-line bg-adm-surface hover:border-adm-ink',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

function ProratedBreakdown({ p, currency, onDone }: { p: ProratedResult; currency: string; onDone: () => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-adm-ok-line bg-adm-ok-bg p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-adm-ok-fg">Detalle de prorrateo</p>
      <div className="space-y-1">
        {([
          ['Días consumidos', `${p.daysConsumed} días`],
          ['Días restantes', `${p.daysRemaining} días`],
          ['Tarifa diaria', fmtMoney(p.dailyRate, currency)],
          ['Crédito a favor', fmtMoney(p.creditAmount / 100, currency)],
          ['Precio nuevo plan', fmtMoney(p.newPlanPrice / 100, currency)],
          ['Crédito aplicado', `- ${fmtMoney(p.creditApplied / 100, currency)}`],
        ] as const).map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-adm-muted">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between border-t border-adm-ok-line pt-2 text-base font-black">
        <span>Total cobrado</span>
        <span className="font-admin-mono text-adm-ok-fg">{fmtMoney(p.amountDue / 100, currency)}</span>
      </div>
      <button type="button" onClick={onDone} className={btn.line}>Listo</button>
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
  const [mode, setMode] = useState<'idle' | 'pay' | 'change'>('idle')
  const [isPending, startTransition] = useTransition()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPendingDelete, startDeleteTransition] = useTransition()
  const [selectedPlanKey, setSelectedPlanKey] = useState('')
  const [changePlanMethod, setChangePlanMethod] = useState<Method>('CASH')
  const [changePlanNotes, setChangePlanNotes] = useState('')
  const [changePlanProration, setChangePlanProration] = useState<ProratedResult | null>(null)
  const [isPendingChangePlan, startChangePlanTransition] = useTransition()

  const availableSubPlans = subPlans.filter(p => p.key.toUpperCase() !== subscription.subscriptionPlan?.toUpperCase())
  const currentPlan = subPlans.find(p => p.key.toUpperCase() === subscription.subscriptionPlan?.toUpperCase())

  const [method, setMethod] = useState<Method>('CASH')

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
        setMode('idle')
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
      }
    })
  }

  const isWarning = subscription.subscriptionStatus === 'GRACE'
  const isSuspended = subscription.subscriptionStatus === 'SUSPENDED'
  const status = STATUS[subscription.subscriptionStatus]
  const lastPeriod = [...billing].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Suscripción"
        id="sub-h"
        action={status && <Pill tone={status.tone}>{status.label}</Pill>}
        className={cn(isSuspended && 'border-adm-bad-line', isWarning && 'border-adm-warn-line')}
      >
        <div className="flex flex-wrap gap-6 p-5">
          <dl className="min-w-0 flex-[1_1_260px] text-sm">
            {([
              ['Plan', currentPlan?.label ?? subscription.subscriptionPlan],
              ...(lastPeriod ? [['Período actual', `${fmt(lastPeriod.periodStart)} → ${fmt(lastPeriod.periodEnd)}`]] : []),
              ...(subscription.subscriptionExpiresAt ? [[
                'Vence',
                `${fmt(subscription.subscriptionExpiresAt)}${subscription.daysUntilExpiry !== null && subscription.daysUntilExpiry > 0 ? ` · ${subscription.daysUntilExpiry} días` : ''}`,
              ]] : []),
              ...(isWarning && subscription.subscriptionGraceEndsAt ? [['Prórroga hasta', fmt(subscription.subscriptionGraceEndsAt)]] : []),
              ['Precio', planAmount != null ? fmtMoney(planAmount, planCurrency) : '—'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-adm-line-soft py-2.5 last:border-b-0">
                <dt className="text-adm-muted">{k}</dt>
                <dd className={cn('text-right font-semibold', k === 'Vence' && isSuspended && 'text-adm-bad-fg', k === 'Vence' && isWarning && 'text-adm-warn-fg')}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
            <button type="button" onClick={() => setMode(mode === 'pay' ? 'idle' : 'pay')} aria-expanded={mode === 'pay'} className={cn(btn.dark, 'min-h-11')}>
              <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
              Registrar pago
            </button>
            <button
              type="button"
              onClick={() => { setMode(mode === 'change' ? 'idle' : 'change'); setChangePlanProration(null) }}
              aria-expanded={mode === 'change'}
              className={cn(btn.line, 'min-h-11')}
            >
              <ArrowRightLeft className="size-4" aria-hidden="true" />
              Cambiar plan (con prorrateo)
            </button>
          </div>
        </div>

        {isWarning && (
          <div className="mx-5 mb-5 rounded-[10px] border border-adm-warn-line bg-adm-warn-bg px-4 py-3 text-[13px] font-medium text-adm-warn-fg">
            El plan venció. El gimnasio tiene acceso en prórroga hasta el {subscription.subscriptionGraceEndsAt ? fmt(subscription.subscriptionGraceEndsAt) : '—'}. Registrá un pago para renovar.
          </div>
        )}
        {isSuspended && (
          <div className="mx-5 mb-5 rounded-[10px] border border-adm-bad-line bg-adm-bad-bg px-4 py-3 text-[13px] font-medium text-adm-bad-fg">
            Suscripción suspendida. El gimnasio no tiene acceso al sistema. Registrá un pago para reactivar.
          </div>
        )}

        {mode === 'pay' && (
          <form onSubmit={handlePay} className="flex flex-col gap-4 border-t border-adm-line-soft bg-adm-subtle p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Registrar pago</p>
              <button type="button" onClick={() => setMode('idle')} aria-label="Cerrar" className={btn.icon}><X className="size-4" /></button>
            </div>
            <div className="flex items-center justify-between rounded-[10px] border border-adm-line bg-adm-surface px-4 py-3">
              <span className="text-[13px] font-semibold text-adm-muted">Monto a cobrar</span>
              <span className="font-admin-mono text-base font-bold">{planAmount != null ? fmtMoney(planAmount, planCurrency) : '—'}</span>
            </div>
            <div>
              <span className={field.label}>Método de pago</span>
              <MethodPicker value={method} onChange={setMethod} disabled={isPending} />
            </div>
            <label className="block max-w-xs">
              <span className={field.label}>Mes</span>
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} disabled={isPending} className={field.input} />
              <span className={field.hint}>{monthToNote(selectedMonth)}</span>
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className={cn(btn.dark, 'min-h-10')}>
                {isPending ? 'Registrando…' : 'Confirmar pago'}
              </button>
              <button type="button" onClick={() => setMode('idle')} className={cn(btn.line, 'min-h-10')}>Cancelar</button>
            </div>
          </form>
        )}

        {mode === 'change' && (
          <div className="border-t border-adm-line-soft bg-adm-subtle p-5">
            {changePlanProration ? (
              <ProratedBreakdown
                p={changePlanProration}
                currency={subPlans.find(p => p.key.toUpperCase() === selectedPlanKey.toUpperCase())?.currency ?? 'USD'}
                onDone={() => { setChangePlanProration(null); setMode('idle'); setSelectedPlanKey('') }}
              />
            ) : (
              <form onSubmit={handleChangePlan} className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Cambiar plan de suscripción</p>
                  <button type="button" onClick={() => setMode('idle')} aria-label="Cerrar" className={btn.icon}><X className="size-4" /></button>
                </div>
                {availableSubPlans.length === 0 ? (
                  <p className="text-sm text-adm-muted">No hay otros planes disponibles.</p>
                ) : (
                  <>
                    <div role="radiogroup" aria-label="Nuevo plan" className="flex flex-wrap gap-2">
                      {availableSubPlans.map(p => (
                        <button
                          key={p.key}
                          type="button"
                          role="radio"
                          aria-checked={selectedPlanKey === p.key}
                          onClick={() => setSelectedPlanKey(p.key)}
                          className={cn(
                            'flex min-w-0 flex-1 basis-44 flex-col items-start gap-1 rounded-xl bg-adm-surface p-3.5 text-left transition-colors',
                            selectedPlanKey === p.key ? 'border-2 border-adm-ink p-[13px]' : 'border border-adm-line hover:border-adm-ink',
                          )}
                        >
                          <span className="text-sm font-bold">{p.label ?? p.key}</span>
                          <span className="font-admin-mono text-[13px]">{p.currency} {parseFloat(String(p.price)).toLocaleString('es-AR')}</span>
                        </button>
                      ))}
                    </div>
                    <div>
                      <span className={field.label}>Método de pago</span>
                      <MethodPicker value={changePlanMethod} onChange={setChangePlanMethod} disabled={isPendingChangePlan} />
                    </div>
                    <label className="block">
                      <span className={field.label}>Notas (opcional)</span>
                      <input
                        type="text"
                        value={changePlanNotes}
                        onChange={e => setChangePlanNotes(e.target.value)}
                        placeholder="Ej. Upgrade manual a Pro"
                        disabled={isPendingChangePlan}
                        className={field.input}
                      />
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" disabled={isPendingChangePlan || !selectedPlanKey} className={cn(btn.dark, 'min-h-10')}>
                        {isPendingChangePlan ? 'Cambiando…' : 'Confirmar cambio'}
                      </button>
                      <button type="button" onClick={() => setMode('idle')} className={cn(btn.line, 'min-h-10')}>Cancelar</button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Pagos de suscripción" id="bill-h" action={<span className="text-[13px] text-adm-muted">{billing.length} registro{billing.length !== 1 ? 's' : ''}</span>}>
        {billing.length === 0 ? (
          <EmptyState>Sin pagos registrados.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className={cn(th, 'pl-5')}>Fecha</th>
                  <th scope="col" className={th}>Período</th>
                  <th scope="col" className={th}>Método</th>
                  <th scope="col" className={th}>Notas</th>
                  <th scope="col" className={cn(th, 'text-right')}>Monto</th>
                  <th scope="col" className={cn(th, 'pr-5')}><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {billing.map(b => (
                  <tr key={b.id} className={cn('hover:bg-adm-subtle', deletingId === b.id && 'opacity-50')}>
                    <td className={cn(td, 'pl-5 font-admin-mono text-[13px]')}>{fmt(b.createdAt)}</td>
                    <td className={cn(td, 'text-[13px] text-adm-muted')}>{fmt(b.periodStart)} → {fmt(b.periodEnd)}</td>
                    <td className={td}>{fmtMethod(b.method)}</td>
                    <td className={cn(td, 'max-w-[220px] truncate text-adm-muted')}>{b.notes ?? '—'}</td>
                    <td className={cn(td, 'text-right font-admin-mono font-bold')}>{fmtMoney(parseFloat(b.amount), b.currency)}</td>
                    <td className={cn(td, 'pr-5 text-right')}>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(b.id)}
                        disabled={isPendingDelete}
                        aria-label={`Eliminar pago del ${fmt(b.createdAt)}`}
                        className={cn(btn.icon, 'hover:bg-adm-bad-bg hover:text-adm-bad-fg')}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => { if (!open) setConfirmDeleteId(null) }}>
        <AlertDialogContent className="admin-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar pago</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que querés eliminar este pago? El estado de la suscripción se recalcula. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBilling} className="bg-[#e5484d] text-white hover:brightness-95">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
