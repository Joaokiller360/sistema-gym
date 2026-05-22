'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react'
import { updateSubscriptionPlanAction, deleteSubscriptionPlanAction, createSubscriptionPlanAction } from './actions'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
}

const CURRENCIES = ['USD', 'ARS', 'EUR', 'BRL', 'MXN']

const PLAN_COLORS: Record<string, string> = {
  BASIC: 'border-zinc-300',
  PRO: 'border-[#1fad9d]',
  ENTERPRISE: 'border-[#fffb00]',
}

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'

function EditPlanCard({ plan }: { plan: SubscriptionPlan }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [label, setLabel] = useState(plan.label)
  const [price, setPrice] = useState(String(Number(plan.price)))
  const [currency, setCurrency] = useState(plan.currency)
  const [maxMembers, setMaxMembers] = useState(plan.maxMembers == null ? '' : String(plan.maxMembers))
  const [storeEnabled, setStoreEnabled] = useState(plan.storeEnabled ?? false)
  const [features, setFeatures] = useState<string[]>(plan.features as string[])
  const [isActive, setIsActive] = useState(plan.isActive)

  function addFeature() { setFeatures(f => [...f, '']) }
  function removeFeature(i: number) { setFeatures(f => f.filter((_, idx) => idx !== i)) }
  function updateFeature(i: number, v: string) { setFeatures(f => f.map((x, idx) => idx === i ? v : x)) }

  function handleSave() {
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) { setError('Precio inválido'); return }
    setError(null)
    startTransition(async () => {
      const res = await updateSubscriptionPlanAction(plan.id, {
        label,
        price,
        currency,
        maxMembers: maxMembers === '' ? null : parseInt(maxMembers),
        storeEnabled,
        features: features.filter(f => f.trim()),
        isActive,
      })
      if (res.error) { setError(res.error) }
      else { setEditing(false); router.refresh() }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteSubscriptionPlanAction(plan.id)
      router.refresh()
    })
  }

  const borderColor = PLAN_COLORS[plan.key] ?? 'border-zinc-200'

  if (!editing) {
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
              <p className="text-2xl font-black mt-1">
                {Number(plan.price) === 0 ? 'Gratis' : `${plan.currency} ${Number(plan.price).toLocaleString('es-AR')}/mes`}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {plan.maxMembers == null ? 'Miembros ilimitados' : `Hasta ${plan.maxMembers} miembros`}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setEditing(true)} className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:border-zinc-400 hover:text-black transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDeleteOpen(true)} className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:border-[#ff0000]/30 hover:text-[#ff0000] transition-colors">
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
              <li key={i} className="flex items-center gap-2 text-sm">
                <Check className="h-3.5 w-3.5 text-[#1fad9d] shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar plan?</AlertDialogTitle>
              <AlertDialogDescription>
                "{plan.label}" será eliminado permanentemente. Esta acción no se puede deshacer.
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
      </>
    )
  }

  return (
    <div className={`rounded-2xl border-2 ${borderColor} bg-white p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <p className="font-bold text-sm">Editando plan</p>
        <button onClick={() => setEditing(false)} className="text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Nombre</label>
          <input value={label} onChange={e => setLabel(e.target.value)} disabled={isPending} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Precio/mes</label>
            <input type="text" inputMode="decimal" maxLength={100} value={price} onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, '').slice(0, 100))} disabled={isPending} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Moneda</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} disabled={isPending} className={inputClass + ' appearance-none'}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Máx. miembros (vacío = ilimitado)</label>
          <input type="number" min="1" value={maxMembers} onChange={e => setMaxMembers(e.target.value)} disabled={isPending} placeholder="Ilimitado" className={inputClass} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block">Tienda incluida</label>
            <p className="text-xs text-zinc-400 mt-0.5">Habilita módulo de tienda para los gyms con este plan</p>
          </div>
          <button
            type="button"
            onClick={() => setStoreEnabled(v => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${storeEnabled ? 'bg-[#1fad9d]' : 'bg-zinc-200'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${storeEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Características</label>
            <button type="button" onClick={addFeature} className="text-xs font-semibold text-[#1fad9d] hover:text-[#0e7a70] flex items-center gap-1">
              <Plus className="h-3 w-3" /> Agregar
            </button>
          </div>
          <div className="space-y-2">
            {features.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input value={f} onChange={e => updateFeature(i, e.target.value)} disabled={isPending} className={inputClass} placeholder={`Característica ${i + 1}`} />
                <button type="button" onClick={() => removeFeature(i)} className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 hover:text-[#ff0000] hover:border-[#ff0000]/30 transition-colors shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Plan activo</label>
          <button
            type="button"
            onClick={() => setIsActive(v => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-[#1fad9d]' : 'bg-zinc-200'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={isPending} className="flex-1 rounded-xl bg-black py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button onClick={() => setEditing(false)} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function NewPlanCard() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('0')
  const [currency, setCurrency] = useState('USD')
  const [maxMembers, setMaxMembers] = useState('')
  const [storeEnabledNew, setStoreEnabledNew] = useState(false)
  const [features, setFeatures] = useState<string[]>([''])

  function handleCreate() {
    if (!key.trim() || !label.trim()) { setError('Clave y nombre requeridos'); return }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) { setError('Precio inválido'); return }
    setError(null)
    startTransition(async () => {
      const res = await createSubscriptionPlanAction({
        key: key.toUpperCase().replace(/\s+/g, '_'),
        label,
        price,
        currency,
        maxMembers: maxMembers === '' ? null : parseInt(maxMembers),
        storeEnabled: storeEnabledNew,
        features: features.filter(f => f.trim()),
      })
      if (res.error) { setError(res.error) }
      else { setOpen(false); router.refresh() }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 p-5 text-sm font-semibold text-zinc-400 hover:border-black hover:text-black transition-all min-h-[200px]"
      >
        <Plus className="h-6 w-6" />
        Nuevo plan
      </button>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-bold text-sm">Nuevo plan</p>
        <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700"><X className="h-4 w-4" /></button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Clave</label>
            <input value={key} onChange={e => setKey(e.target.value)} disabled={isPending} placeholder="Ej. STARTER" className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Nombre</label>
            <input value={label} onChange={e => setLabel(e.target.value)} disabled={isPending} placeholder="Ej. Starter" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Precio/mes</label>
            <input type="text" inputMode="decimal" maxLength={100} value={price} onChange={e => setPrice(e.target.value.replace(/[^0-9.]/g, '').slice(0, 100))} disabled={isPending} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Moneda</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} disabled={isPending} className={inputClass + ' appearance-none'}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">Máx. miembros</label>
          <input type="number" min="1" value={maxMembers} onChange={e => setMaxMembers(e.target.value)} disabled={isPending} placeholder="Ilimitado" className={inputClass} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block">Tienda incluida</label>
            <p className="text-xs text-zinc-400 mt-0.5">Habilita módulo de tienda para gyms con este plan</p>
          </div>
          <button
            type="button"
            onClick={() => setStoreEnabledNew(v => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${storeEnabledNew ? 'bg-[#1fad9d]' : 'bg-zinc-200'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${storeEnabledNew ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Características</label>
            <button type="button" onClick={() => setFeatures(f => [...f, ''])} className="text-xs font-semibold text-[#1fad9d]">+ Agregar</button>
          </div>
          {features.map((f, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={f} onChange={e => setFeatures(prev => prev.map((x, idx) => idx === i ? e.target.value : x))} disabled={isPending} className={inputClass} placeholder={`Característica ${i + 1}`} />
              <button type="button" onClick={() => setFeatures(prev => prev.filter((_, idx) => idx !== i))} className="h-9 w-9 flex items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 hover:text-[#ff0000] shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}

      <div className="flex gap-3">
        <button onClick={handleCreate} disabled={isPending} className="flex-1 rounded-xl bg-black py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
          {isPending ? 'Creando…' : 'Crear plan'}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
          Cancelar
        </button>
      </div>
    </div>
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
