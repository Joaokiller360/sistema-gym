'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, CheckCircle2, ChevronRight, Star } from 'lucide-react'
import { toast } from 'sonner'
import { registerMemberPaymentAction } from './actions'
import type { Member, Plan } from '@/types'

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'

const METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
] as const

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function memberInitials(m: Member) {
  return `${m.firstName[0]}${m.lastName[0]}`.toUpperCase()
}

export function NewPaymentForm({
  gymSlug,
  members,
  plans,
}: {
  gymSlug: string
  members: Member[]
  plans: Plan[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Step 1 — member
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  // Step 2 — plan
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)

  // Step 3 — dates & payment
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [months, setMonths] = useState(1)
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH')

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members.slice(0, 8)
    const q = memberSearch.toLowerCase()
    return members.filter(m =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [members, memberSearch])

  const endDate = useMemo(() => {
    if (!selectedPlan) return null
    return addDays(new Date(startDate), selectedPlan.durationDays * months)
  }, [selectedPlan, startDate, months])

  const step = !selectedMember ? 1 : !selectedPlan ? 2 : 3

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMember || !selectedPlan) return

    const totalAmount = Number(selectedPlan.price) * months
    if (!totalAmount || totalAmount <= 0) {
      toast.error('No se puede registrar un pago de $0. Revisá el precio del plan.')
      return
    }

    setError(null)
    startTransition(async () => {
      const res = await registerMemberPaymentAction(gymSlug, {
        memberId: selectedMember.id,
        planId: selectedPlan.id,
        startDate,
        durationDays: selectedPlan.durationDays * months,
        amount: totalAmount,
        currency: selectedPlan.currency,
        method,
      })
      if (res?.error) {
        toast.error(res.error)
        setError(res.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Progress breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold">
        {['Miembro', 'Plan', 'Confirmar'].map((label, i) => {
          const n = i + 1
          const done = step > n
          const active = step === n
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-3 w-3 text-zinc-300" />}
              <span className={`flex items-center gap-1.5 ${active ? 'text-black' : done ? 'text-[#1fad9d]' : 'text-zinc-400'}`}>
                {done
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${active ? 'border-black bg-black text-white' : 'border-zinc-300 text-zinc-400'}`}>{n}</span>
                }
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Step 1 — Select member */}
      <div className={`rounded-2xl border bg-white overflow-hidden transition-all ${step === 1 ? 'border-black' : 'border-zinc-200'}`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
          <span className="text-sm font-bold">1. Seleccionar miembro</span>
          {selectedMember && (
            <button type="button" onClick={() => { setSelectedMember(null); setSelectedPlan(null) }} className="text-xs text-zinc-400 hover:text-black transition-colors">
              Cambiar
            </button>
          )}
        </div>

        {selectedMember ? (
          <div className="flex items-center gap-3 px-5 py-3">
            <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
              {selectedMember.photoUrl
                ? <img src={selectedMember.photoUrl} alt="" className="h-full w-full object-cover" />
                : <span className="text-xs font-bold text-zinc-500">{memberInitials(selectedMember)}</span>
              }
            </div>
            <div>
              <p className="text-sm font-semibold">{selectedMember.firstName} {selectedMember.lastName}</p>
              <p className="text-xs text-zinc-400">{selectedMember.email}</p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-[#1fad9d] ml-auto" />
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Buscar por nombre o email…"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all"
              />
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {filteredMembers.length === 0
                ? <p className="text-xs text-zinc-400 text-center py-4">Sin resultados</p>
                : filteredMembers.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMember(m)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-zinc-50 transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {m.photoUrl
                        ? <img src={m.photoUrl} alt="" className="h-full w-full object-cover" />
                        : <span className="text-xs font-bold text-zinc-500">{memberInitials(m)}</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{m.firstName} {m.lastName}</p>
                      <p className="text-xs text-zinc-400 truncate">{m.email}</p>
                    </div>
                  </button>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* Step 2 — Select plan */}
      {step >= 2 && (
        <div className={`rounded-2xl border bg-white overflow-hidden transition-all ${step === 2 ? 'border-black' : 'border-zinc-200'}`}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
            <span className="text-sm font-bold">2. Seleccionar plan</span>
            {selectedPlan && (
              <button type="button" onClick={() => setSelectedPlan(null)} className="text-xs text-zinc-400 hover:text-black transition-colors">
                Cambiar
              </button>
            )}
          </div>

          {selectedPlan ? (
            <div className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{selectedPlan.name}</p>
                  {selectedPlan.isFeatured && <Star className="h-3 w-3 text-[#fffb00] fill-[#fffb00]" />}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{selectedPlan.durationDays} días{selectedPlan.daysPerWeek ? ` · ${selectedPlan.daysPerWeek}x/sem` : ''}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold">{selectedPlan.currency} {Number(selectedPlan.price).toLocaleString('es-AR')}</span>
                <CheckCircle2 className="h-4 w-4 text-[#1fad9d]" />
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {plans.filter(p => p.isActive).length === 0
                ? <p className="text-xs text-zinc-400 text-center py-4">Sin planes activos</p>
                : plans.filter(p => p.isActive).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlan(p)}
                    className="w-full flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 hover:border-black hover:bg-zinc-50 transition-all text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{p.name}</p>
                        {p.isFeatured && <Star className="h-3 w-3 text-[#fffb00] fill-[#fffb00]" />}
                      </div>
                      <p className="text-xs text-zinc-400 mt-0.5">{p.durationDays} días{p.daysPerWeek ? ` · ${p.daysPerWeek}x/sem` : ''}</p>
                      {p.benefits?.length > 0 && (
                        <p className="text-xs text-zinc-400 truncate max-w-[200px]">{p.benefits.slice(0, 2).join(' · ')}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold shrink-0 ml-4">{p.currency} {Number(p.price).toLocaleString('es-AR')}</span>
                  </button>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Vigencia + payment method */}
      {step === 3 && selectedPlan && (
        <div className="rounded-2xl border border-black bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100">
            <span className="text-sm font-bold">3. Vigencia y pago</span>
          </div>

          <div className="p-5 space-y-5">
            {/* Vigencia */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Fecha de inicio</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  disabled={isPending}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Cantidad de meses</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMonths(m => Math.max(1, m - 1))}
                    disabled={isPending || months <= 1}
                    className="h-9 w-9 rounded-xl border border-zinc-200 flex items-center justify-center text-lg font-bold hover:border-zinc-300 disabled:opacity-40 transition-all"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-bold">{months}</span>
                  <button
                    type="button"
                    onClick={() => setMonths(m => Math.min(6, m + 1))}
                    disabled={isPending || months >= 6}
                    className="h-9 w-9 rounded-xl border border-zinc-200 flex items-center justify-center text-lg font-bold hover:border-zinc-300 disabled:opacity-40 transition-all"
                  >
                    +
                  </button>
                  <span className="text-xs text-zinc-400">{selectedPlan.durationDays * months} días en total</span>
                </div>
              </div>

              {endDate && (
                <div className="rounded-xl bg-[#1fad9d]/8 border border-[#1fad9d]/20 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#0e7a70] mb-1">Vigencia</p>
                    <p className="text-sm font-semibold text-[#0e7a70]">
                      {fmtDate(new Date(startDate))} → {fmtDate(endDate)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-xs text-[#1fad9d]">{selectedPlan.durationDays * months} días</p>
                  </div>
                </div>
              )}
            </div>

            {/* Payment method */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Método de pago</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {METHODS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMethod(m.value)}
                    disabled={isPending}
                    className={`rounded-xl py-2.5 text-xs font-semibold border-2 transition-all ${
                      method === m.value
                        ? 'border-black bg-black text-white'
                        : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Total a cobrar</span>
              <span className="text-base font-black">
                {selectedPlan.currency} {(Number(selectedPlan.price) * months).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl bg-black py-3 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isPending ? 'Registrando…' : 'Confirmar pago y crear membresía'}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
