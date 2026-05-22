'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { Plan } from '@/types'
import { assignPlanAction } from './actions'

const METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
] as const

interface Props {
  memberId: string
  gymSlug: string
  plans: Plan[]
  activeMembershipId?: string
}

export function AssignPlanForm({ memberId, gymSlug, plans, activeMembershipId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [planId, setPlanId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const activePlans = plans.filter(p => p.isActive)
  const selectedPlan = activePlans.find(p => p.id === planId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!planId || !selectedPlan) return
    setError(null)
    startTransition(async () => {
      const res = await assignPlanAction(gymSlug, memberId, {
        planId,
        startDate,
        durationDays: selectedPlan.durationDays,
        price: Number(selectedPlan.price),
        currency: selectedPlan.currency,
        method,
      }, activeMembershipId)
      if (res.error) {
        setError(res.error)
      } else {
        setOpen(false)
        setPlanId('')
        router.refresh()
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-500 hover:border-[#1fad9d] hover:text-[#1fad9d] transition-all w-full justify-center"
      >
        <Plus className="h-4 w-4" />
        Asignar plan
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-[#1fad9d]/30 bg-[#1fad9d]/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">Asignar plan</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Plan</label>
        {activePlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay planes activos disponibles</p>
        ) : (
          <div className="space-y-2">
            {activePlans.map(p => (
              <label
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                  planId === p.id ? 'border-[#1fad9d] bg-white' : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={p.id}
                  checked={planId === p.id}
                  onChange={() => setPlanId(p.id)}
                  className="accent-[#1fad9d]"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.price.toLocaleString('es-AR', { style: 'currency', currency: p.currency })}
                    {' · '}{p.durationDays} días
                    {p.daysPerWeek !== null ? ` · ${p.daysPerWeek}×/sem` : ' · Ilimitado'}
                  </p>
                </div>
                {p.isFeatured && (
                  <span className="text-[10px] font-bold bg-[#fffb00] text-black px-2 py-0.5 rounded-full shrink-0">★ Destacado</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      {selectedPlan && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Fecha de inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d] focus:border-transparent transition-all"
            />
            <p className="text-xs text-muted-foreground">
              Vence el{' '}
              {(() => {
                const end = new Date(startDate)
                end.setDate(end.getDate() + selectedPlan.durationDays)
                return end.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
              })()}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Método de pago</label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  disabled={isPending}
                  className={`rounded-xl py-2 text-xs font-semibold border-2 transition-all ${
                    method === m.value
                      ? 'border-[#1fad9d] bg-[#1fad9d] text-white'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || !planId}
          className="flex-1 rounded-xl bg-[#1fad9d] py-2.5 text-sm font-bold text-white hover:bg-[#0e7a70] disabled:opacity-50 transition-all"
        >
          {isPending ? 'Asignando…' : 'Confirmar'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
