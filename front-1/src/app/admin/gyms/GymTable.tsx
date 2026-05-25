'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Building2, ExternalLink, MapPin, Globe, Clock, CreditCard, ShoppingBag, Calendar, Users, Star, ArrowRightLeft, CheckCircle2, AlertTriangle, Ban, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Gym } from '@/types'
import { toggleGymActiveAction, fetchGymModalDataAction, changeGymPlanAction, type GymModalData, type ProratedResult } from './actions'

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SubscriptionBadge({ status }: { status: 'ACTIVE' | 'GRACE' | 'SUSPENDED' }) {
  if (status === 'ACTIVE') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-[#1fad9d]/15 text-[#0e7a70] border border-[#1fad9d]/30">
      <CheckCircle2 className="h-2.5 w-2.5" /> Activa
    </span>
  )
  if (status === 'GRACE') return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
      <AlertTriangle className="h-2.5 w-2.5" /> Prórroga
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
      <Ban className="h-2.5 w-2.5" /> Suspendida
    </span>
  )
}

function ProratedBreakdown({ p, currency, onDone }: { p: ProratedResult; currency: string; onDone: () => void }) {
  const fmt = (n: number) => `${currency} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  return (
    <div className="rounded-xl bg-[#1fad9d]/8 border border-[#1fad9d]/20 p-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#0e7a70]">Detalle del cambio</p>
      <div className="space-y-1">
        {([
          ['Crédito a favor', fmt(p.creditAmount)],
          ['Precio nuevo plan', fmt(p.newPlanPrice)],
          ['Crédito aplicado', `- ${fmt(p.creditApplied)}`],
        ] as const).map(([label, value]) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-zinc-500">{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
        <div className="border-t border-[#1fad9d]/20 pt-1.5 flex justify-between text-sm font-black">
          <span>Total cobrado</span>
          <span className="text-[#0e7a70]">{fmt(p.amountDue)}</span>
        </div>
      </div>
      <button type="button" onClick={onDone} className="text-xs font-semibold text-[#1fad9d] hover:text-[#0e7a70] transition-colors">
        ✓ Listo
      </button>
    </div>
  )
}

export function GymTable({ gyms }: { gyms: Gym[] }) {
  const [, startTransition] = useTransition()
  const [selected, setSelected] = useState<Gym | null>(null)
  const [modalData, setModalData] = useState<GymModalData | null>(null)
  const [loadingModal, setLoadingModal] = useState(false)

  // Change plan state
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [selectedPlanKey, setSelectedPlanKey] = useState('')
  const [changePlanMethod, setChangePlanMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH')
  const [changePlanNotes, setChangePlanNotes] = useState('')
  const [proration, setProration] = useState<ProratedResult | null>(null)
  const [isPendingPlan, startPlanTransition] = useTransition()
  const [planError, setPlanError] = useState<string | null>(null)

  function handleToggle(gymId: string, active: boolean) {
    startTransition(async () => {
      await toggleGymActiveAction(gymId, active)
    })
  }

  function openModal(gym: Gym) {
    setSelected(gym)
    setModalData(null)
    setLoadingModal(true)
    setShowChangePlan(false)
    setSelectedPlanKey('')
    setProration(null)
    setPlanError(null)
    fetchGymModalDataAction(gym.id).then(data => {
      setModalData(data)
      setLoadingModal(false)
    })
  }

  function closeModal() {
    setSelected(null)
    setModalData(null)
    setShowChangePlan(false)
    setSelectedPlanKey('')
    setProration(null)
    setPlanError(null)
  }

  function handleChangePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !selectedPlanKey) return
    setPlanError(null)
    startPlanTransition(async () => {
      const res = await changeGymPlanAction(selected.id, {
        planKey: selectedPlanKey,
        method: changePlanMethod,
        notes: changePlanNotes.trim() || undefined,
      }, selected.slug)
      if (res.error) {
        setPlanError(res.error)
      } else {
        setProration(res.proration ?? null)
        // refresh modal data
        const data = await fetchGymModalDataAction(selected.id)
        setModalData(data)
      }
    })
  }

  const availableSubPlans = modalData?.subPlans.filter(
    p => p.key.toUpperCase() !== modalData.subscription?.subscriptionPlan?.toUpperCase()
  ) ?? []

  if (gyms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-sm text-muted-foreground">
        <Building2 className="h-12 w-12 mb-3 opacity-20" />
        No se encontraron gimnasios.
      </div>
    )
  }

  const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all disabled:opacity-50'

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {gyms.map(gym => (
          <div
            key={gym.id}
            onClick={() => openModal(gym)}
            className="bg-white rounded-2xl border border-zinc-200 px-4 py-3.5 cursor-pointer hover:border-[#1fad9d]/40 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
                {gym.logoUrl
                  ? <img src={gym.logoUrl} alt={gym.name} className="h-full w-full object-cover" />
                  : <span className="text-sm font-black text-black">{initials(gym.name)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{gym.name}</p>
                <p className="text-xs text-muted-foreground">{gym.slug}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                <Switch
                  checked={gym.isActive}
                  onCheckedChange={v => handleToggle(gym.id, v)}
                  aria-label={gym.isActive ? 'Deshabilitar' : 'Habilitar'}
                />
                <Link
                  href={`/admin/gyms/${gym.id}`}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  Entrar
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block rounded-2xl border border-zinc-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500">Gimnasio</th>
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden md:table-cell">Dueño</th>
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500">Estado</th>
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Creado</th>
              <th className="text-center px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500">Activo</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {gyms.map(gym => (
              <tr
                key={gym.id}
                onClick={() => openModal(gym)}
                className="hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
                      {gym.logoUrl
                        ? <img src={gym.logoUrl} alt={gym.name} className="h-full w-full object-cover" />
                        : <span className="text-xs font-black text-black">{initials(gym.name)}</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{gym.name}</p>
                      <p className="text-xs text-muted-foreground">{gym.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 hidden md:table-cell">
                  {gym.owner
                    ? <div>
                        <p className="font-medium text-sm">{gym.owner.name}</p>
                        <p className="text-xs text-zinc-400">{gym.owner.email}</p>
                      </div>
                    : <span className="text-zinc-400">—</span>
                  }
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={gym.isActive ? 'active' : 'inactive'} />
                </td>
                <td className="px-5 py-4 text-muted-foreground hidden lg:table-cell">{formatDate(gym.createdAt)}</td>
                <td className="px-5 py-4 text-center" onClick={e => e.stopPropagation()}>
                  <Switch
                    checked={gym.isActive}
                    onCheckedChange={v => handleToggle(gym.id, v)}
                    aria-label={gym.isActive ? 'Deshabilitar' : 'Habilitar'}
                  />
                </td>
                <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                  <Link
                    href={`/admin/gyms/${gym.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-700 hover:border-[#1fad9d]/50 hover:text-[#1fad9d] transition-all shadow-xs"
                  >
                    Entrar
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gym detail modal */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) closeModal() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" showCloseButton>
          {selected && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                  {selected.logoUrl
                    ? <img src={selected.logoUrl} alt={selected.name} className="h-full w-full object-cover" />
                    : <span className="text-xl font-black text-black">{initials(selected.name)}</span>
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-black tracking-tight truncate">{selected.name}</h2>
                  <p className="text-xs text-zinc-400 font-mono">{selected.slug}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <StatusBadge status={selected.isActive ? 'active' : 'inactive'} />
                    {modalData?.subscription && <SubscriptionBadge status={modalData.subscription.subscriptionStatus} />}
                  </div>
                </div>
              </div>

              {/* Owner */}
              {selected.owner && (
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Dueño</p>
                  <p className="font-bold text-sm">{selected.owner.name}</p>
                  <p className="text-xs text-zinc-500">{selected.owner.email}</p>
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-zinc-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Plan sub.</p>
                    <p className="text-sm font-bold truncate">
                      {modalData?.subscription?.subscriptionPlan ?? selected.subscriptionPlan}
                    </p>
                    {modalData?.subscription?.subscriptionExpiresAt && (
                      <p className="text-[10px] text-zinc-400">
                        Vence {formatDate(modalData.subscription.subscriptionExpiresAt)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-zinc-400 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Tienda</p>
                    <p className="text-sm font-bold">{selected.storeEnabled ? 'Habilitada' : 'Deshabilitada'}</p>
                  </div>
                </div>
                {selected.country && (
                  <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-zinc-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">País</p>
                      <p className="text-sm font-bold">{selected.country}</p>
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Timezone</p>
                    <p className="text-sm font-bold truncate">{selected.timezone}</p>
                  </div>
                </div>
                {selected.address && (
                  <div className="col-span-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-zinc-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Dirección</p>
                      <p className="text-sm font-bold">{selected.address}</p>
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-400 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Creado</p>
                    <p className="text-sm font-bold">{formatDate(selected.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Loading spinner */}
              {loadingModal && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
              )}

              {modalData && (
                <>
                  {/* Members */}
                  <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-zinc-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Miembros</span>
                      </div>
                      <Link
                        href={`/gym/${selected.slug}/members`}
                        className="text-[10px] font-bold text-[#1fad9d] hover:text-[#0e7a70] transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        Ver todos →
                      </Link>
                    </div>
                    {modalData.members.length === 0 ? (
                      <p className="px-4 py-5 text-xs text-zinc-400 text-center">Sin miembros registrados</p>
                    ) : (
                      <ul className="divide-y divide-zinc-100">
                        {modalData.members.map(m => (
                          <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="h-7 w-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                              {m.photoUrl
                                ? <img src={m.photoUrl} alt={`${m.firstName} ${m.lastName}`} className="h-full w-full object-cover" />
                                : <span className="text-[10px] font-bold text-zinc-500">{m.firstName[0]}{m.lastName[0]}</span>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{m.firstName} {m.lastName}</p>
                              <p className="text-[10px] text-zinc-400 truncate">{m.email}</p>
                            </div>
                            <StatusBadge status={m.isActive ? 'active' : 'inactive'} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Plans */}
                  {modalData.plans.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Planes ofrecidos</span>
                        <span className="text-[10px] text-zinc-400">{modalData.plans.length} plan{modalData.plans.length !== 1 ? 'es' : ''}</span>
                      </div>
                      <ul className="divide-y divide-zinc-100">
                        {modalData.plans.map(p => (
                          <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {p.isFeatured && <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                              <p className="text-xs font-semibold truncate">{p.name}</p>
                              <span className="text-[10px] text-zinc-400 shrink-0">{p.durationDays}d</span>
                            </div>
                            <p className="text-xs font-bold shrink-0">{p.currency} {p.price.toLocaleString('es-AR')}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Change plan */}
                  <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => { setShowChangePlan(v => !v); setProration(null); setPlanError(null) }}
                      className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Cambiar plan de suscripción
                      </div>
                      <span className="text-zinc-300">{showChangePlan ? '▲' : '▼'}</span>
                    </button>

                    {showChangePlan && (
                      <div className="border-t border-zinc-100 p-4 space-y-3">
                        {proration ? (
                          <ProratedBreakdown
                            p={proration}
                            currency={modalData.subPlans.find(p => p.key.toUpperCase() === selectedPlanKey.toUpperCase())?.currency ?? 'USD'}
                            onDone={() => { setProration(null); setShowChangePlan(false); setSelectedPlanKey('') }}
                          />
                        ) : (
                          <form onSubmit={handleChangePlan} className="space-y-3">
                            {availableSubPlans.length === 0 ? (
                              <p className="text-xs text-zinc-400">No hay otros planes disponibles.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {availableSubPlans.map(p => (
                                  <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => setSelectedPlanKey(p.key)}
                                    className={`w-full flex items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left transition-all text-xs ${
                                      selectedPlanKey === p.key ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
                                    }`}
                                  >
                                    <span className="font-semibold">{p.label ?? p.key}</span>
                                    <span className="font-bold">{p.currency} {parseFloat(String(p.price)).toLocaleString('es-AR')}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {availableSubPlans.length > 0 && (
                              <>
                                <select
                                  value={changePlanMethod}
                                  onChange={e => setChangePlanMethod(e.target.value as typeof changePlanMethod)}
                                  disabled={isPendingPlan}
                                  className={inputClass}
                                >
                                  <option value="CASH">Efectivo</option>
                                  <option value="CARD">Tarjeta</option>
                                  <option value="TRANSFER">Transferencia</option>
                                  <option value="OTHER">Otro</option>
                                </select>
                                <input
                                  type="text"
                                  value={changePlanNotes}
                                  onChange={e => setChangePlanNotes(e.target.value)}
                                  placeholder="Notas (opcional)"
                                  disabled={isPendingPlan}
                                  className={inputClass}
                                />
                                {planError && <p className="text-xs text-red-600 font-medium">{planError}</p>}
                                <button
                                  type="submit"
                                  disabled={isPendingPlan || !selectedPlanKey}
                                  className="w-full rounded-xl bg-black py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
                                >
                                  {isPendingPlan ? 'Cambiando…' : 'Confirmar cambio de plan'}
                                </button>
                              </>
                            )}
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* CTA */}
              <Link
                href={`/admin/gyms/${selected.id}`}
                className="flex items-center justify-center gap-2 w-full rounded-xl bg-black py-3 text-sm font-bold text-white hover:bg-zinc-800 transition-all"
              >
                Ir al gimnasio
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
