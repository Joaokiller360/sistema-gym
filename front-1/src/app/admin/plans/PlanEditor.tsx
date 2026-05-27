'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Check, X, Pencil, GripVertical, Star, Tag } from 'lucide-react'
import { updateSubscriptionPlanAction, deleteSubscriptionPlanAction, createSubscriptionPlanAction, setSubscriptionPlanDiscountAction, toggleSubscriptionPlanDiscountAction } from './actions'
import { createBlockHandlers } from '@/lib/input-validation'

const textHandlers = createBlockHandlers('text')
const priceHandlers = createBlockHandlers('price')
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface SubscriptionPlan {
  id: string
  key: string
  label: string
  price: number
  currency: string
  maxMembers: number | null
  storeEnabled: boolean
  features: string[]
  isActive: boolean
  sortOrder: number
  discountPercent: number
  discountActive: boolean
  finalPrice: number
  discountSaving: number
  yearlyPrice: number | null
  yearlyFinalPrice: number | null
  yearlySaving: number | null
  yearlyMonthlyEquivalent: number | null
}

const CURRENCIES = ['USD', 'ARS', 'EUR', 'BRL', 'MXN']

const PLAN_COLORS: Record<string, string> = {
  BASIC: 'border-zinc-300',
  PRO: 'border-[#1fad9d]',
  ENTERPRISE: 'border-[#fffb00]',
}

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'

const BENEFIT_PREFIX = '★ '
function isBenefit(f: string) { return f.startsWith('★') }
function featureText(f: string) { return f.replace(/^★\s*/, '') }
function toggleBenefit(f: string) { return isBenefit(f) ? featureText(f) : BENEFIT_PREFIX + f }

interface PlanFormFields {
  label: string
  price: string
  currency: string
  maxMembers: string
  storeEnabled: boolean
  features: string[]
  isActive: boolean
}

function FeaturesList({
  features,
  isPending,
  onChange,
}: {
  features: string[]
  isPending: boolean
  onChange: (features: string[]) => void
}) {
  const dragIdx = useRef<number | null>(null)

  function handleDragStart(i: number) { dragIdx.current = i }
  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === i) return
    const from = dragIdx.current
    dragIdx.current = i
    const next = [...features]
    const [item] = next.splice(from, 1)
    next.splice(i, 0, item)
    onChange(next)
  }
  function handleDragEnd() { dragIdx.current = null }

  return (
    <div className="space-y-2">
      {features.map((f, i) => (
        <div
          key={i}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragOver={e => handleDragOver(e, i)}
          onDragEnd={handleDragEnd}
          className="flex gap-2 items-center"
        >
          <GripVertical className="h-4 w-4 text-zinc-300 cursor-grab shrink-0" />
          <input
            value={featureText(f)}
            onChange={e => onChange(features.map((x, idx) => idx === i ? (isBenefit(x) ? BENEFIT_PREFIX + e.target.value : e.target.value) : x))}
            disabled={isPending}
            className={inputClass}
            placeholder={`Característica ${i + 1}`}
            {...textHandlers}
          />
          <button
            type="button"
            title={isBenefit(f) ? 'Quitar beneficio destacado' : 'Marcar como beneficio destacado'}
            onClick={() => onChange(features.map((x, idx) => idx === i ? toggleBenefit(x) : x))}
            className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-colors shrink-0 ${isBenefit(f) ? 'border-amber-400 text-amber-400 bg-amber-50' : 'border-zinc-200 text-zinc-400 hover:border-amber-400 hover:text-amber-400'}`}
          >
            <Star className="h-3.5 w-3.5" fill={isBenefit(f) ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={() => onChange(features.filter((_, idx) => idx !== i))}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 hover:text-[#ff0000] hover:border-[#ff0000]/30 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

function PlanFormBody({
  fields,
  onChange,
  isPending,
  showKey,
  planKey,
  onPlanKeyChange,
}: {
  fields: PlanFormFields
  onChange: (f: PlanFormFields) => void
  isPending: boolean
  showKey?: boolean
  planKey?: string
  onPlanKeyChange?: (v: string) => void
}) {
  return (
    <div className="space-y-3">
      {showKey && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Clave</label>
            <input value={planKey ?? ''} onChange={e => onPlanKeyChange?.(e.target.value)} disabled={isPending} placeholder="Ej. STARTER" className={inputClass} {...textHandlers} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Nombre</label>
            <input value={fields.label} onChange={e => onChange({ ...fields, label: e.target.value })} disabled={isPending} placeholder="Ej. Starter" className={inputClass} {...textHandlers} />
          </div>
        </div>
      )}
      {!showKey && (
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Nombre</label>
          <input value={fields.label} onChange={e => onChange({ ...fields, label: e.target.value })} disabled={isPending} className={inputClass} {...textHandlers} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Precio/mes</label>
          <input
            type="text"
            inputMode="decimal"
            maxLength={100}
            value={fields.price}
            onChange={e => onChange({ ...fields, price: e.target.value.replace(/[^0-9.]/g, '').slice(0, 100) })}
            disabled={isPending}
            className={inputClass}
            {...priceHandlers}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Moneda</label>
          <select value={fields.currency} onChange={e => onChange({ ...fields, currency: e.target.value })} disabled={isPending} className={inputClass + ' appearance-none'}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Máx. miembros (vacío = ilimitado)</label>
        <input type="number" min="1" value={fields.maxMembers} onChange={e => onChange({ ...fields, maxMembers: e.target.value })} disabled={isPending} placeholder="Ilimitado" className={inputClass} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block">Tienda incluida</label>
          <p className="text-xs text-zinc-400 mt-0.5">Habilita módulo de tienda para los gyms con este plan</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...fields, storeEnabled: !fields.storeEnabled })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${fields.storeEnabled ? 'bg-[#1fad9d]' : 'bg-zinc-200'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${fields.storeEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Características</label>
          <button type="button" onClick={() => onChange({ ...fields, features: [...fields.features, ''] })} className="text-xs font-semibold text-[#1fad9d] hover:text-[#0e7a70] flex items-center gap-1">
            <Plus className="h-3 w-3" /> Agregar
          </button>
        </div>
        <FeaturesList features={fields.features} isPending={isPending} onChange={v => onChange({ ...fields, features: v })} />
      </div>

      {!showKey && (
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Plan activo</label>
          <button
            type="button"
            onClick={() => onChange({ ...fields, isActive: !fields.isActive })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${fields.isActive ? 'bg-[#1fad9d]' : 'bg-zinc-200'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${fields.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
        </div>
      )}
    </div>
  )
}

function EditPlanCard({ plan }: { plan: SubscriptionPlan }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [discountOpen, setDiscountOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [discountActive, setDiscountActive] = useState(plan.discountActive)
  const [discountPct, setDiscountPct] = useState(String(plan.discountPercent ?? 0))
  const [yearlyPrice, setYearlyPrice] = useState(plan.yearlyPrice != null ? String(plan.yearlyPrice) : '')
  const [discountError, setDiscountError] = useState<string | null>(null)

  const [fields, setFields] = useState<PlanFormFields>({
    label: plan.label,
    price: String(Number(plan.price)),
    currency: plan.currency,
    maxMembers: plan.maxMembers == null ? '' : String(plan.maxMembers),
    storeEnabled: plan.storeEnabled ?? false,
    features: plan.features as string[],
    isActive: plan.isActive,
  })

  function resetFields() {
    setFields({
      label: plan.label,
      price: String(Number(plan.price)),
      currency: plan.currency,
      maxMembers: plan.maxMembers == null ? '' : String(plan.maxMembers),
      storeEnabled: plan.storeEnabled ?? false,
      features: plan.features as string[],
      isActive: plan.isActive,
    })
    setError(null)
  }

  function handleSave() {
    if (isNaN(parseFloat(fields.price)) || parseFloat(fields.price) < 0) { setError('Precio inválido'); return }
    setError(null)
    startTransition(async () => {
      const res = await updateSubscriptionPlanAction(plan.id, {
        label: fields.label,
        price: fields.price,
        currency: fields.currency,
        maxMembers: fields.maxMembers === '' ? null : parseInt(fields.maxMembers),
        storeEnabled: fields.storeEnabled,
        features: fields.features.filter(f => f.trim()),
        isActive: fields.isActive,
      }, plan.key)
      if (res.error) { setError(res.error) }
      else { setEditOpen(false); router.refresh() }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSubscriptionPlanAction(plan.id)
      router.refresh()
    })
  }

  function handleToggleDiscount() {
    setDiscountActive(v => !v)
    startTransition(async () => {
      await toggleSubscriptionPlanDiscountAction(plan.id)
      router.refresh()
    })
  }

  function handleSaveDiscount() {
    setDiscountError(null)
    const pct = Math.min(100, Math.max(0, Number(discountPct) || 0))
    const yearly = yearlyPrice !== '' ? Number(yearlyPrice) : undefined
    startTransition(async () => {
      const res = await setSubscriptionPlanDiscountAction(plan.id, { discountPercent: pct, ...(yearly !== undefined && { yearlyPrice: yearly }) })
      if (res.error) { setDiscountError(res.error); return }
      router.refresh()
      setDiscountOpen(false)
    })
  }

  const hasDiscount = (plan.discountPercent ?? 0) > 0
  const discountIsOn = discountActive && hasDiscount
  const fmt = (v: number) => `${plan.currency} ${v.toLocaleString('es-AR')}`

  const borderColor = PLAN_COLORS[plan.key] ?? 'border-zinc-200'

  return (
    <>
      <div className={`rounded-2xl border-2 ${borderColor} bg-white p-5 space-y-4`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-black text-lg">{plan.label}</p>
              {!plan.isActive && (
                <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">Inactivo</span>
              )}
            </div>
            <div className="mt-1">
              {discountIsOn ? (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-black">{fmt(plan.finalPrice)}/mes</span>
                  <span className="text-sm text-zinc-400 line-through">{fmt(plan.price)}</span>
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                    {plan.discountPercent}% OFF
                  </span>
                </div>
              ) : (
                <p className="text-2xl font-black">
                  {Number(plan.price) === 0 ? 'Gratis' : `${fmt(plan.price)}/mes`}
                </p>
              )}
              {discountIsOn && plan.yearlyMonthlyEquivalent != null && (
                <p className="text-xs font-semibold text-[#1fad9d] mt-0.5">
                  Solo {fmt(plan.yearlyMonthlyEquivalent)}/mes pagando anual
                </p>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {plan.maxMembers == null ? 'Miembros ilimitados' : `Hasta ${plan.maxMembers} miembros`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setDiscountOpen(true)} aria-label={`Gestionar descuento ${plan.label}`} className={`h-8 w-8 flex items-center justify-center rounded-lg border transition-colors ${discountIsOn ? 'border-emerald-300 text-emerald-600 bg-emerald-50' : 'border-zinc-200 text-zinc-400 hover:border-[#1fad9d]/50 hover:text-[#1fad9d]'}`}>
              <Tag className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { resetFields(); setEditOpen(true) }} aria-label={`Editar plan ${plan.label}`} className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:border-zinc-400 hover:text-black transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setDeleteOpen(true)} aria-label={`Eliminar plan ${plan.label}`} className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:border-[#ff0000]/30 hover:text-[#ff0000] transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {plan.storeEnabled && (
          <p className="text-xs font-bold text-[#1fad9d] bg-[#1fad9d]/10 rounded-full px-2.5 py-1 w-fit">
            🏪 Tienda incluida
          </p>
        )}
        <ul className="space-y-1.5">
          {(plan.features as string[]).map((f, i) => (
            <li key={i} className={`flex items-center gap-2 text-sm ${isBenefit(f) ? 'font-semibold' : ''}`}>
              {isBenefit(f)
                ? <Star className="h-3.5 w-3.5 text-amber-400 shrink-0" fill="currentColor" />
                : <Check className="h-3.5 w-3.5 text-[#1fad9d] shrink-0" />
              }
              {featureText(f)}
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={editOpen} onOpenChange={open => { if (!open) resetFields(); setEditOpen(open) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Editar plan — {plan.label}</DialogTitle>
          </DialogHeader>
          <PlanFormBody fields={fields} onChange={setFields} isPending={isPending} />
          {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={isPending} className="flex-1 rounded-xl bg-black py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button onClick={() => { resetFields(); setEditOpen(false) }} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plan?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{plan.label}&rdquo; será eliminado permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
              {isPending ? '…' : 'Eliminar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#1fad9d]" />
              Descuento — {plan.label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Descuento (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={discountPct}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 3)
                  const n = Math.min(100, Number(v))
                  setDiscountPct(v === '' ? '' : String(n))
                }}
                className={inputClass}
                placeholder="0"
              />
            </div>

            {Number(discountPct) > 0 && (
              <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Descuento activo</p>
                  <p className="text-xs text-zinc-400">
                    {discountIsOn
                      ? `Aplicando ${plan.discountPercent}% — ahorro ${fmt(plan.discountSaving)}/mes`
                      : 'Descuento pausado'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleDiscount}
                  disabled={isPending}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${discountActive ? 'bg-[#1fad9d]' : 'bg-zinc-200'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${discountActive ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>
            )}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Precio anual (opcional)</label>
              <input
                type="number"
                min={0}
                value={yearlyPrice}
                onChange={e => setYearlyPrice(e.target.value)}
                className={inputClass}
                placeholder="Dejar vacío para no ofrecer"
              />
              {discountIsOn && plan.yearlyMonthlyEquivalent != null && (
                <p className="text-xs text-zinc-400 mt-1">Equivale a {fmt(plan.yearlyMonthlyEquivalent)}/mes</p>
              )}
            </div>
          </div>

          {discountError && <p className="text-xs text-[#ff0000] font-medium px-1">{discountError}</p>}
          <DialogFooter>
            <button onClick={() => { setDiscountOpen(false); setDiscountError(null) }} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
              Cancelar
            </button>
            <button onClick={handleSaveDiscount} disabled={isPending} className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function NewPlanCard() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [planKey, setPlanKey] = useState('')
  const [fields, setFields] = useState<PlanFormFields>({
    label: '',
    price: '0',
    currency: 'USD',
    maxMembers: '',
    storeEnabled: false,
    features: [''],
    isActive: true,
  })

  function resetForm() {
    setPlanKey('')
    setFields({ label: '', price: '0', currency: 'USD', maxMembers: '', storeEnabled: false, features: [''], isActive: true })
    setError(null)
  }

  function handleCreate() {
    if (!planKey.trim() || !fields.label.trim()) { setError('Clave y nombre requeridos'); return }
    if (isNaN(parseFloat(fields.price)) || parseFloat(fields.price) < 0) { setError('Precio inválido'); return }
    setError(null)
    startTransition(async () => {
      const res = await createSubscriptionPlanAction({
        key: planKey.toUpperCase().replace(/\s+/g, '_'),
        label: fields.label,
        price: fields.price,
        currency: fields.currency,
        maxMembers: fields.maxMembers === '' ? null : parseInt(fields.maxMembers),
        storeEnabled: fields.storeEnabled,
        features: fields.features.filter(f => f.trim()),
      })
      if (res.error) { setError(res.error) }
      else { setOpen(false); resetForm(); router.refresh() }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 p-5 text-sm font-semibold text-zinc-400 hover:border-black hover:text-black transition-all min-h-[200px]"
      >
        <Plus className="h-6 w-6" />
        Nuevo plan
      </button>

      <Dialog open={open} onOpenChange={o => { if (!o) resetForm(); setOpen(o) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Nuevo plan</DialogTitle>
          </DialogHeader>
          <PlanFormBody fields={fields} onChange={setFields} isPending={isPending} showKey planKey={planKey} onPlanKeyChange={setPlanKey} />
          {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={handleCreate} disabled={isPending} className="flex-1 rounded-xl bg-black py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
              {isPending ? 'Creando…' : 'Crear plan'}
            </button>
            <button onClick={() => { resetForm(); setOpen(false) }} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PlanEditor({ plans }: { plans: SubscriptionPlan[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
      {plans.map(p => <EditPlanCard key={p.id} plan={p} />)}
      <NewPlanCard />
    </div>
  )
}
