'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Plus, Trash2, Check, X, GripVertical, Star, Tag } from 'lucide-react'
import { updateSubscriptionPlanAction, deleteSubscriptionPlanAction, createSubscriptionPlanAction, setSubscriptionPlanDiscountAction, toggleSubscriptionPlanDiscountAction } from './actions'
import { createBlockHandlers } from '@/lib/input-validation'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { PageHeader, Pill, Switch, btn, field } from '@/components/admin/ui'

const textHandlers = createBlockHandlers('text')
const priceHandlers = createBlockHandlers('price')

export interface SubscriptionPlan {
  id: string
  key: string
  label: string
  price: number
  currency: string
  maxMembers: number | null
  storeEnabled: boolean
  demoEnabled: boolean
  trialEnabled: boolean
  advancedReportsEnabled: boolean
  visibleOnLanding: boolean
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

const BANDS = ['bg-[#c9c9c1] dark:bg-[#3a3a3d]', 'bg-[#0e7a70]', 'bg-adm-brand border-b border-adm-night']
const PLAN_BAND: Record<string, string> = { BASIC: BANDS[0], PRO: BANDS[1], ENTERPRISE: BANDS[2], PREMIUM: BANDS[2] }

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
  demoEnabled: boolean
  trialEnabled: boolean
  advancedReportsEnabled: boolean
  visibleOnLanding: boolean
  features: string[]
  isActive: boolean
}

const EMPTY_FIELDS: PlanFormFields = {
  label: '',
  price: '0',
  currency: 'USD',
  maxMembers: '',
  storeEnabled: false,
  demoEnabled: false,
  trialEnabled: false,
  advancedReportsEnabled: false,
  visibleOnLanding: true,
  features: [''],
  isActive: true,
}

function fieldsFromPlan(plan: SubscriptionPlan): PlanFormFields {
  return {
    label: plan.label,
    price: String(Number(plan.price)),
    currency: plan.currency,
    maxMembers: plan.maxMembers == null ? '' : String(plan.maxMembers),
    storeEnabled: plan.storeEnabled ?? false,
    demoEnabled: plan.demoEnabled ?? false,
    trialEnabled: plan.trialEnabled ?? false,
    advancedReportsEnabled: plan.advancedReportsEnabled ?? false,
    visibleOnLanding: plan.visibleOnLanding ?? true,
    features: plan.features as string[],
    isActive: plan.isActive,
  }
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
    <div className="flex flex-col gap-2">
      {features.map((f, i) => (
        <div
          key={i}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragOver={e => handleDragOver(e, i)}
          onDragEnd={handleDragEnd}
          className="flex items-center gap-2"
        >
          <GripVertical className="size-4 shrink-0 cursor-grab text-adm-muted/60" aria-hidden="true" />
          <input
            value={featureText(f)}
            onChange={e => onChange(features.map((x, idx) => idx === i ? (isBenefit(x) ? BENEFIT_PREFIX + e.target.value : e.target.value) : x))}
            disabled={isPending}
            className={field.input}
            aria-label={`Característica ${i + 1}`}
            placeholder={`Característica ${i + 1}`}
            {...textHandlers}
          />
          <button
            type="button"
            aria-pressed={isBenefit(f)}
            aria-label={isBenefit(f) ? 'Quitar beneficio destacado' : 'Marcar como beneficio destacado'}
            title={isBenefit(f) ? 'Quitar beneficio destacado' : 'Marcar como beneficio destacado'}
            onClick={() => onChange(features.map((x, idx) => idx === i ? toggleBenefit(x) : x))}
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-[10px] border transition-colors',
              isBenefit(f) ? 'border-adm-warn-line bg-adm-warn-bg text-adm-warn-fg' : 'border-adm-line text-adm-muted hover:border-adm-ink hover:text-adm-ink',
            )}
          >
            <Star className="size-4" fill={isBenefit(f) ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            aria-label={`Quitar característica ${i + 1}`}
            onClick={() => onChange(features.filter((_, idx) => idx !== i))}
            className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-adm-line text-adm-muted transition-colors hover:border-adm-bad-line hover:text-adm-bad-fg"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

const TOGGLES: { key: keyof PlanFormFields; label: string; hint: string; editOnly?: boolean }[] = [
  { key: 'storeEnabled', label: 'Tienda incluida', hint: 'Habilita el módulo de tienda' },
  { key: 'advancedReportsEnabled', label: 'Reportes avanzados', hint: 'Panel de reportes en el dashboard del gym' },
  { key: 'demoEnabled', label: 'Demo habilitada', hint: 'Se puede pedir una demo desde la landing' },
  { key: 'trialEnabled', label: 'Prueba gratis (1 mes)', hint: '30 días sin costo' },
  { key: 'visibleOnLanding', label: 'Visible en la landing', hint: 'Aparece en la página pública de precios' },
  { key: 'isActive', label: 'Plan activo', hint: 'Se puede asignar a gimnasios', editOnly: true },
]

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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-4">
        {showKey && (
          <label className="min-w-0 flex-1 basis-40">
            <span className={field.label}>Clave</span>
            <input value={planKey ?? ''} onChange={e => onPlanKeyChange?.(e.target.value)} disabled={isPending} placeholder="Ej. STARTER" className={cn(field.input, 'font-admin-mono uppercase')} {...textHandlers} />
          </label>
        )}
        <label className="min-w-0 flex-1 basis-40">
          <span className={field.label}>Nombre</span>
          <input value={fields.label} onChange={e => onChange({ ...fields, label: e.target.value })} disabled={isPending} placeholder="Ej. Starter" className={field.input} {...textHandlers} />
        </label>
        <label className="min-w-0 flex-1 basis-40">
          <span className={field.label}>Precio mensual</span>
          <input
            type="text"
            inputMode="decimal"
            maxLength={100}
            value={fields.price}
            onChange={e => onChange({ ...fields, price: e.target.value.replace(/[^0-9.]/g, '').slice(0, 100) })}
            disabled={isPending}
            className={cn(field.input, 'font-admin-mono')}
            {...priceHandlers}
          />
        </label>
        <label className="min-w-0 flex-[0_1_120px]">
          <span className={field.label}>Moneda</span>
          <select value={fields.currency} onChange={e => onChange({ ...fields, currency: e.target.value })} disabled={isPending} className={field.input}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="min-w-0 flex-1 basis-40">
          <span className={field.label}>Máx. miembros</span>
          <input type="number" min="1" value={fields.maxMembers} onChange={e => onChange({ ...fields, maxMembers: e.target.value })} disabled={isPending} placeholder="Ilimitado" className={field.input} />
        </label>
      </div>

      <div>
        <span className={field.label}>Incluye</span>
        <div className="flex flex-wrap gap-2">
          {TOGGLES.filter(t => !t.editOnly || !showKey).map(t => (
            <div key={t.key} className="flex min-w-0 flex-[1_1_240px] items-center gap-3 rounded-[10px] border border-adm-line-soft px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.label}</p>
                <p className="text-xs text-adm-muted">{t.hint}</p>
              </div>
              <Switch
                checked={fields[t.key] as boolean}
                onChange={v => onChange({ ...fields, [t.key]: v })}
                disabled={isPending}
                label={t.label}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className={cn(field.label, 'mb-0')}>Características</span>
          <span className="text-xs text-adm-muted">Arrastrá para ordenar · ★ destaca</span>
        </div>
        <FeaturesList features={fields.features} isPending={isPending} onChange={v => onChange({ ...fields, features: v })} />
        <button type="button" onClick={() => onChange({ ...fields, features: [...fields.features, ''] })} className={cn(btn.line, 'mt-2')}>
          <Plus className="size-3.5" aria-hidden="true" /> Agregar característica
        </button>
      </div>
    </div>
  )
}

function PlanEditorPanel({
  plan,
  onClose,
}: {
  plan: SubscriptionPlan | null
  onClose: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [planKey, setPlanKey] = useState('')
  const [fields, setFields] = useState<PlanFormFields>(plan ? fieldsFromPlan(plan) : EMPTY_FIELDS)

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  function handleSave() {
    if (!plan && (!planKey.trim() || !fields.label.trim())) { setError('Clave y nombre requeridos'); return }
    if (isNaN(parseFloat(fields.price)) || parseFloat(fields.price) < 0) { setError('Precio inválido'); return }
    setError(null)
    const common = {
      label: fields.label,
      price: fields.price,
      currency: fields.currency,
      maxMembers: fields.maxMembers === '' ? null : parseInt(fields.maxMembers),
      storeEnabled: fields.storeEnabled,
      demoEnabled: fields.demoEnabled,
      trialEnabled: fields.trialEnabled,
      advancedReportsEnabled: fields.advancedReportsEnabled,
      visibleOnLanding: fields.visibleOnLanding,
      features: fields.features.filter(f => f.trim()),
    }
    startTransition(async () => {
      const res = plan
        ? await updateSubscriptionPlanAction(plan.id, { ...common, isActive: fields.isActive }, plan.key)
        : await createSubscriptionPlanAction({ ...common, key: planKey.toUpperCase().replace(/\s+/g, '_') })
      if (res.error) { setError(res.error) }
      else onClose()
    })
  }

  return (
    <section ref={ref} aria-labelledby="ed-h" className="scroll-mt-6 rounded-2xl border-2 border-adm-ink bg-adm-surface p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] text-adm-muted">{plan ? 'Editando' : 'Nuevo'}</p>
          <h2 id="ed-h" className="text-[22px] font-extrabold">{plan ? `Plan ${plan.label}` : 'Nuevo plan'}</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className={cn(btn.line, 'min-h-11 text-sm')}>Descartar</button>
          <button type="button" onClick={handleSave} disabled={isPending} className={btn.primary}>
            {isPending ? 'Guardando…' : plan ? 'Guardar plan' : 'Crear plan'}
          </button>
        </div>
      </div>
      <PlanFormBody fields={fields} onChange={setFields} isPending={isPending} showKey={!plan} planKey={planKey} onPlanKeyChange={setPlanKey} />
      {error && <p role="alert" className={cn(field.error, 'mt-4')}>{error}</p>}
    </section>
  )
}

function PlanCard({
  plan,
  index,
  yearly,
  gymCount,
  editing,
  onEdit,
}: {
  plan: SubscriptionPlan
  index: number
  yearly: boolean
  gymCount: number
  editing: boolean
  onEdit: () => void
}) {
  const [discountOpen, setDiscountOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [discountActive, setDiscountActive] = useState(plan.discountActive)
  const [discountPct, setDiscountPct] = useState(String(plan.discountPercent ?? 0))
  const [yearlyPrice, setYearlyPrice] = useState(plan.yearlyPrice != null ? String(plan.yearlyPrice) : '')
  const [discountError, setDiscountError] = useState<string | null>(null)

  function handleDelete() {
    startTransition(async () => {
      await deleteSubscriptionPlanAction(plan.id)
      setDeleteOpen(false)
    })
  }

  function handleToggleDiscount() {
    setDiscountActive(v => !v)
    startTransition(async () => {
      await toggleSubscriptionPlanDiscountAction(plan.id)
    })
  }

  function handleSaveDiscount() {
    setDiscountError(null)
    const pct = Math.min(100, Math.max(0, Number(discountPct) || 0))
    const yearlyValue = yearlyPrice !== '' ? Number(yearlyPrice) : undefined
    startTransition(async () => {
      const res = await setSubscriptionPlanDiscountAction(plan.id, { discountPercent: pct, ...(yearlyValue !== undefined && { yearlyPrice: yearlyValue }) })
      if (res.error) { setDiscountError(res.error); return }
      setDiscountOpen(false)
    })
  }

  const hasDiscount = (plan.discountPercent ?? 0) > 0
  const discountIsOn = discountActive && hasDiscount
  const fmt = (v: number) => `${plan.currency} ${Number(v).toLocaleString('es-AR')}`
  const free = Number(plan.price) === 0
  const yearTotal = plan.yearlyFinalPrice ?? plan.yearlyPrice
  const band = PLAN_BAND[plan.key] ?? BANDS[index % BANDS.length]

  const flags: [boolean, string][] = [
    [plan.storeEnabled, 'Tienda'],
    [plan.advancedReportsEnabled, 'Reportes'],
    [plan.demoEnabled, 'Demo'],
    [plan.trialEnabled, 'Prueba gratis'],
  ]

  return (
    <>
      <article
        className={cn(
          'flex min-w-0 flex-[1_1_280px] flex-col overflow-hidden rounded-2xl bg-adm-surface',
          editing ? 'border-2 border-adm-ink' : 'border border-adm-line',
          !plan.isActive && 'opacity-75',
        )}
      >
        <div className={cn('h-2', band)} />
        <div className="flex flex-1 flex-col gap-3.5 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-admin-mono text-[11px] font-bold tracking-[0.08em] text-adm-muted">{plan.key}</p>
              <h2 className="mt-0.5 truncate text-2xl font-extrabold [font-stretch:112%]">{plan.label}</h2>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Pill tone="ok">{gymCount} gimnasio{gymCount !== 1 ? 's' : ''}</Pill>
              {!plan.isActive && <Pill>Inactivo</Pill>}
            </div>
          </div>

          <div>
            {!yearly && discountIsOn && (
              <div className="flex items-center gap-2 text-[13px]">
                <span className="font-admin-mono text-adm-muted line-through">{fmt(plan.price)}</span>
                <span className="rounded-full bg-adm-ink px-2 py-0.5 text-[11px] font-bold text-adm-brand dark:text-adm-night dark:bg-adm-brand">-{plan.discountPercent}%</span>
              </div>
            )}
            <p className="mt-1 font-admin-mono text-[30px] font-bold leading-tight tracking-tight">
              {free ? 'Gratis' : yearly ? (yearTotal != null ? fmt(yearTotal) : '—') : fmt(discountIsOn ? plan.finalPrice : plan.price)}
              {!free && (yearly ? yearTotal != null : true) && (
                <span className="text-sm font-medium text-adm-muted"> / {yearly ? 'año' : 'mes'}</span>
              )}
            </p>
            {!free && (
              <p className="mt-1 text-[13px] text-adm-muted">
                {yearly
                  ? yearTotal != null
                    ? `Equivale a ${fmt(plan.yearlyMonthlyEquivalent ?? Math.round(yearTotal / 12))} / mes`
                    : 'Sin precio anual'
                  : yearTotal != null
                    ? `o ${fmt(yearTotal)} al año`
                    : 'Solo pago mensual'}
              </p>
            )}
          </div>

          <p className="text-sm font-semibold">{plan.maxMembers == null ? 'Miembros ilimitados' : `Hasta ${plan.maxMembers} miembros`}</p>

          <ul className="flex flex-col gap-2 text-sm">
            {(plan.features as string[]).map((f, i) => (
              <li key={i} className={cn('flex items-start gap-2', isBenefit(f) && 'font-semibold')}>
                {isBenefit(f)
                  ? <Star className="mt-0.5 size-4 shrink-0 text-adm-warn-fg" fill="currentColor" aria-label="Destacado" />
                  : <Check className="mt-0.5 size-4 shrink-0 text-adm-ok-fg" strokeWidth={2.6} aria-hidden="true" />}
                {featureText(f)}
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
            {flags.map(([on, label]) => (
              <Pill key={label} className={cn(!on && 'bg-adm-surface line-through')}>
                <span className="sr-only">{on ? 'Incluye' : 'No incluye'} </span>{label}
              </Pill>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-adm-line-soft px-5 py-3">
          <span className="text-[13px] text-adm-muted">{plan.visibleOnLanding ? 'Visible en la landing' : 'Oculto en la landing'}</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setDiscountOpen(true)}
              aria-label={`Gestionar descuento de ${plan.label}`}
              title="Descuento y precio anual"
              className={cn(btn.icon, discountIsOn && 'bg-adm-ok-bg text-adm-ok-fg')}
            >
              <Tag className="size-4" />
            </button>
            <button type="button" onClick={() => setDeleteOpen(true)} aria-label={`Eliminar plan ${plan.label}`} className={cn(btn.icon, 'hover:bg-adm-bad-bg hover:text-adm-bad-fg')}>
              <Trash2 className="size-4" />
            </button>
            <button type="button" onClick={onEdit} aria-pressed={editing} className={btn.line}>Editar</button>
          </div>
        </div>
      </article>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm" className="admin-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plan?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{plan.label}&rdquo; se elimina permanentemente.
              {gymCount > 0 && ` Hay ${gymCount} gimnasio${gymCount !== 1 ? 's' : ''} con este plan.`} No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <button type="button" disabled={isPending} onClick={handleDelete} className={btn.dangerSolid}>
              {isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent className="admin-surface max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-4 text-adm-ok-fg" aria-hidden="true" />
              Descuento — {plan.label}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            <label className="block">
              <span className={field.label}>Descuento (%)</span>
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
                className={field.input}
                placeholder="0"
              />
            </label>

            {Number(discountPct) > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-[10px] border border-adm-line px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Descuento activo</p>
                  <p className="text-xs text-adm-muted">
                    {discountIsOn ? `Aplicando ${plan.discountPercent}% — ahorro ${fmt(plan.discountSaving)}/mes` : 'Descuento pausado'}
                  </p>
                </div>
                <Switch checked={discountActive} onChange={handleToggleDiscount} disabled={isPending} label="Descuento activo" />
              </div>
            )}
            <label className="block">
              <span className={field.label}>Precio anual (opcional)</span>
              <input
                type="number"
                min={0}
                value={yearlyPrice}
                onChange={e => setYearlyPrice(e.target.value)}
                className={cn(field.input, 'font-admin-mono')}
                placeholder="Dejar vacío para no ofrecer"
              />
              {plan.yearlyMonthlyEquivalent != null && (
                <span className={field.hint}>Equivale a {fmt(plan.yearlyMonthlyEquivalent)}/mes</span>
              )}
            </label>
          </div>

          {discountError && <p className={field.error}>{discountError}</p>}
          <DialogFooter>
            <button onClick={() => { setDiscountOpen(false); setDiscountError(null) }} className={cn(btn.line, 'min-h-10')}>Cancelar</button>
            <button onClick={handleSaveDiscount} disabled={isPending} className={cn(btn.dark, 'min-h-10')}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type Editing = { mode: 'edit'; id: string } | { mode: 'new' } | null

export function PlanEditor({ plans, gymCounts }: { plans: SubscriptionPlan[]; gymCounts: Record<string, number> }) {
  const [yearly, setYearly] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)
  const [editorKey, setEditorKey] = useState(0)

  function open(next: Editing) {
    setEditing(next)
    setEditorKey(k => k + 1)
  }

  const editingPlan = editing?.mode === 'edit' ? plans.find(p => p.id === editing.id) ?? null : null

  return (
    <>
      <PageHeader
        eyebrow="Suscripciones que contratan los gimnasios"
        title="Planes"
        actions={
          <>
            <div role="group" aria-label="Ver precios" className="flex gap-1 rounded-[10px] border border-adm-line bg-adm-surface p-1">
              {([false, true] as const).map(y => (
                <button
                  key={String(y)}
                  type="button"
                  aria-pressed={yearly === y}
                  onClick={() => setYearly(y)}
                  className={cn(
                    'min-h-9 rounded-md px-3.5 text-[13px] font-semibold transition-colors',
                    yearly === y ? 'bg-adm-ink text-adm-surface' : 'text-adm-muted hover:text-adm-ink',
                  )}
                >
                  {y ? 'Anual' : 'Mensual'}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => open({ mode: 'new' })} className={btn.primary}>
              <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
              Nuevo plan
            </button>
          </>
        }
      />

      {plans.length === 0 ? (
        <button
          type="button"
          onClick={() => open({ mode: 'new' })}
          className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-adm-line text-sm font-semibold text-adm-muted transition-colors hover:border-adm-ink hover:text-adm-ink"
        >
          <Plus className="size-6" aria-hidden="true" />
          Crear el primer plan
        </button>
      ) : (
        <section aria-label="Planes" className="flex flex-wrap gap-3">
          {plans.map((p, i) => (
            <PlanCard
              key={p.id}
              plan={p}
              index={i}
              yearly={yearly}
              gymCount={gymCounts[p.key.toUpperCase()] ?? 0}
              editing={editing?.mode === 'edit' && editing.id === p.id}
              onEdit={() => open({ mode: 'edit', id: p.id })}
            />
          ))}
        </section>
      )}

      {editing && (editing.mode === 'new' || editingPlan) && (
        <PlanEditorPanel key={editorKey} plan={editingPlan} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
