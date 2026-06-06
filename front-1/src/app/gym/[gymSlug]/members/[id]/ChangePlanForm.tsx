'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft, CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { changeMemberPlanAction, ProratedResult } from './actions'
import type { Plan } from '@/types'

const METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
] as const

function fmtMoney(n: number, currency = 'USD') {
  return `${currency} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
}

function ProratedBreakdown({ p, currency }: { p: ProratedResult; currency: string }) {
  return (
    <div className="rounded-xl bg-[#1fad9d]/8 border border-[#1fad9d]/20 p-4 space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-[#0e7a70]">Detalle de prorrateo</p>
      <div className="space-y-1">
        {[
          ['Días consumidos', `${p.daysConsumed} días`],
          ['Días restantes', `${p.daysRemaining} días`],
          ['Tarifa diaria', fmtMoney(p.dailyRate, currency)],
          ['Crédito a favor', fmtMoney(p.creditAmount/100, currency)],
          ['Precio nuevo plan', fmtMoney(p.newPlanPrice/100, currency)],
          ['Crédito aplicado', `- ${fmtMoney(p.creditApplied/100, currency)}`],
        ].map(([label, value]) => (
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
  )
}

export function ChangePlanForm({
  memberId,
  gymSlug,
  membershipId,
  currentPlanId,
  plans,
}: {
  memberId: string
  gymSlug: string
  membershipId: string
  currentPlanId?: string
  plans: Plan[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH')
  const [notes, setNotes] = useState('')
  const [proration, setProration] = useState<ProratedResult | null>(null)

  const availablePlans = plans.filter(p => p.isActive && p.id !== currentPlanId)
  const selectedPlan = availablePlans.find(p => p.id === selectedPlanId)

  function reset() {
    setOpen(false)
    setSelectedPlanId('')
    setNotes('')
    setProration(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlanId) return
    startTransition(async () => {
      const res = await changeMemberPlanAction(gymSlug, memberId, membershipId, {
        planId: selectedPlanId,
        method,
        notes: notes.trim() || undefined,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        setProration(res.proration ?? null)
        toast.success('Plan cambiado correctamente')
        router.refresh()
      }
    })
  }

  if (proration) {
    return (
      <div className="space-y-3">
        <ProratedBreakdown p={proration} currency={selectedPlan?.currency ?? 'USD'} />
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-black transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-[#1fad9d]" /> Listo
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-500 hover:border-black hover:text-black transition-all w-full justify-center"
      >
        <ArrowRightLeft className="h-4 w-4" />
        Cambiar plan
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-zinc-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">Cambiar plan</p>
        <button type="button" onClick={reset} className="text-zinc-400 hover:text-zinc-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {availablePlans.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-4">No hay otros planes activos disponibles.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Nuevo plan</label>
            <div className="space-y-2">
              {availablePlans.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    selectedPlanId === p.id ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-zinc-400">
                      {p.durationDays} días{p.daysPerWeek ? ` · ${p.daysPerWeek}x/sem` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold shrink-0 ml-3">
                    {p.currency} {Number(p.price).toLocaleString('es-AR')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Método de pago</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  disabled={isPending}
                  className={`rounded-xl py-2 text-xs font-semibold border-2 transition-all ${
                    method === m.value ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Notas (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej. Upgrade a Pro"
              disabled={isPending}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fffb00] transition-all disabled:opacity-50"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || !selectedPlanId}
              className="flex-1 rounded-xl bg-black py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
            >
              {isPending ? 'Cambiando…' : 'Confirmar cambio de plan'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </form>
  )
}
