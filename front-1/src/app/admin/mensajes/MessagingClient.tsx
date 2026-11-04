'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PageHeader, Panel, Pill, Stat, Switch, btn, field, toneText, type Tone } from '@/components/admin/ui'
import type { SubscriptionPlan } from '../plans/PlanEditor'
import { updateSubscriptionPlanAction } from '../plans/actions'
import {
  approvePurchaseAction, cancelPurchaseAction, deletePackAction, deletePurchaseAction, rejectPurchaseAction, savePackAction, setCostAction,
  togglePackAction, type PackInput,
} from './actions'

export interface MessagingSummary {
  costPerMessage: number
  messagesThisMonth: number
  spentThisMonth: number
  packRevenueCents: number
  monthlyRecurringCents: number
  activeMonthly: number
  pendingRequests: number
}

export interface AdminPack {
  id: string
  name: string
  messages: number
  price: number
  currency: string
  billing: 'ONCE' | 'MONTHLY'
  planKeys: string[]
  isActive: boolean
}

export interface AdminPurchase {
  id: string
  name: string
  messages: number
  price: number
  currency: string
  billing: 'ONCE' | 'MONTHLY'
  status: 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'REJECTED'
  createdAt: string
  paidAt: string | null
  gym: { id: string; name: string; slug: string }
}

const METHODS = [
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'OTHER', label: 'Otro' },
] as const
type Method = (typeof METHODS)[number]['value']

const usd = (n: number, digits = 2) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })
const money = (n: number, currency: string) =>
  n.toLocaleString('es-AR', { style: 'currency', currency, minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })
const num = (n: number) => n.toLocaleString('es-AR')
const parseNum = (v: string) => Number(v.replace(',', '.'))

const BILLING_OPTIONS = [
  ['ONCE', 'Pago único', 'Se cobra una vez. Los mensajes no vencen.'],
  ['MONTHLY', 'Mensual', 'Se cobra cada mes con la suscripción y suma los mensajes al plan.'],
] as const

interface ConfirmOptions {
  title: string
  body: React.ReactNode
  action: string
  tone?: 'danger' | 'dark'
}

/** In-page replacement for window.confirm: `if (!(await confirm({...}))) return` */
function useConfirm() {
  const [open, setOpen] = useState(false)
  // Kept after closing so the text doesn't vanish during the exit animation
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolve = useRef<((ok: boolean) => void) | null>(null)

  function confirm(o: ConfirmOptions) {
    setOpts(o)
    setOpen(true)
    return new Promise<boolean>(r => { resolve.current = r })
  }
  function close(ok: boolean) {
    resolve.current?.(ok)
    resolve.current = null
    setOpen(false)
  }

  const dialog = (
    <AlertDialog open={open} onOpenChange={o => { if (!o) close(false) }}>
      <AlertDialogContent className="admin-surface">
        <AlertDialogHeader>
          <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
          <AlertDialogDescription>{opts?.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <button type="button" onClick={() => close(true)} className={opts?.tone === 'dark' ? btn.dark : btn.dangerSolid}>
            {opts?.action}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
  return [confirm, dialog] as const
}

/** What a pack leaves after paying the provider for its messages (packs and cost share the currency) */
function margin(price: number, messages: number, cost: number) {
  const spend = messages * cost
  const gain = price - spend
  return { spend, gain, pct: price > 0 ? Math.round((gain / price) * 100) : 0 }
}
const marginTone = (m: { gain: number; pct: number }) => (m.gain < 0 ? 'bad' : m.pct < 30 ? 'warn' : 'ok')

export function MessagingClient({
  summary, packs, purchases, plans, gymCounts,
}: {
  summary: MessagingSummary | null
  packs: AdminPack[]
  purchases: AdminPurchase[]
  plans: SubscriptionPlan[]
  gymCounts: Record<string, number>
}) {
  const cost = summary?.costPerMessage ?? 0
  const [editing, setEditing] = useState<AdminPack | 'new' | null>(null)
  const pending = purchases.filter(p => p.status === 'PENDING')
  const sales = purchases.filter(p => p.status !== 'PENDING')
  const planLabel = new Map(plans.map(p => [p.key, p.label]))

  return (
    <>
      <PageHeader
        eyebrow="Lo que te cobra el proveedor y lo que pagan los gimnasios"
        title="Mensajes y packs"
        actions={
          <button type="button" onClick={() => setEditing('new')} className={btn.primary}>
            <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
            Nuevo pack
          </button>
        }
      />

      {/* Opens where the person is looking: right under the button */}
      {editing && (
        <PackEditor
          key={editing === 'new' ? 'new' : editing.id}
          pack={editing === 'new' ? null : editing}
          plans={plans}
          cost={cost}
          onClose={() => setEditing(null)}
        />
      )}

      <CostPanel summary={summary} />

      {pending.length > 0 && <PendingPanel pending={pending} />}

      <PlanLimitsPanel plans={plans} gymCounts={gymCounts} cost={cost} />

      <Panel
        title="Packs de mensajes"
        id="packs-h"
        action={<span className="text-[13px] text-adm-muted">Lo que ven los gimnasios en “Comprar más mensajes”</span>}
      >
        {packs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <p className="text-sm text-adm-muted">Todavía no hay packs. Crea uno para que los gimnasios puedan comprar más mensajes.</p>
            <button type="button" onClick={() => setEditing('new')} className={btn.line}>
              <Plus className="size-3.5" aria-hidden="true" /> Crear el primer pack
            </button>
          </div>
        ) : (
          <>
            <div className={cn(PACK_GRID, 'hidden border-b border-adm-line-soft bg-adm-subtle py-2.5 text-xs font-semibold text-adm-muted md:grid')} aria-hidden="true">
              <span>Pack</span><span>Mensajes</span><span>Precio</span><span>Margen</span><span>Activo</span><span />
            </div>
            <ul>
              {packs.map(p => <PackRow key={p.id} pack={p} cost={cost} planLabel={planLabel} onEdit={() => setEditing(p)} />)}
            </ul>
          </>
        )}
      </Panel>

      {sales.length > 0 && <SalesPanel sales={sales} />}
    </>
  )
}

// Desktop columns; on phones each row stacks with its own labels
const PLAN_GRID = 'md:grid md:grid-cols-[minmax(0,1.3fr)_8.5rem_minmax(0,0.9fr)_minmax(0,1.2fr)_6.5rem] md:items-center md:gap-4 px-5'
const PACK_GRID = 'md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_3.5rem_5rem] md:items-center md:gap-4 px-5'

/** Caption shown above a value only on phones, where the column header is hidden */
function Cap({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-adm-muted md:hidden">{children}</span>
}

function CostPanel({ summary }: { summary: MessagingSummary | null }) {
  const [value, setValue] = useState(String(summary?.costPerMessage ?? 0).replace('.', ','))
  const [isPending, startTransition] = useTransition()
  const dirty = parseNum(value) !== (summary?.costPerMessage ?? 0)

  function save() {
    const c = parseNum(value)
    startTransition(async () => {
      const res = await setCostAction(c)
      if (res.error) toast.error(res.error)
      else toast.success('Costo por mensaje guardado')
    })
  }

  return (
    <section aria-label="Costo y consumo" className="flex flex-wrap gap-3">
      <div className="flex min-w-0 flex-[1_1_260px] flex-col rounded-2xl border border-adm-line bg-adm-surface p-5">
        <label htmlFor="cost" className={field.label}>Te cuesta cada mensaje (USD)</label>
        <div className="flex gap-2">
          <input
            id="cost"
            inputMode="decimal"
            value={value}
            onChange={e => setValue(e.target.value.replace(/[^\d,.]/g, '').slice(0, 8))}
            className={cn(field.input, 'font-admin-mono')}
          />
          <button type="button" onClick={save} disabled={!dirty || isPending || !Number.isFinite(parseNum(value))} className={cn(btn.dark, 'min-h-11')}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        <p className={field.hint}>Lo que te cobra Meta / Zernio por mensaje. Con esto se calcula el margen de cada pack.</p>
      </div>
      <Stat label="Enviados este mes" value={num(summary?.messagesThisMonth ?? 0)} hint="Todos los gimnasios" />
      <Stat
        label="Te costaron"
        value={summary?.costPerMessage ? usd(summary.spentThisMonth) : '—'}
        hint={summary?.costPerMessage ? `a ${usd(summary.costPerMessage, 3)} por mensaje` : 'Carga tu costo por mensaje'}
        hintTone={summary?.costPerMessage ? 'neutral' : 'warn'}
      />
      <Stat
        label="Vendido en packs este mes"
        value={usd((summary?.packRevenueCents ?? 0) / 100)}
        hint={summary?.activeMonthly ? `+ ${usd(summary.monthlyRecurringCents / 100)}/mes en ${summary.activeMonthly} extra${summary.activeMonthly !== 1 ? 's' : ''} mensual${summary.activeMonthly !== 1 ? 'es' : ''}` : 'Sin extras mensuales activos'}
        hintTone="ok"
      />
    </section>
  )
}

function PendingPanel({ pending }: { pending: AdminPurchase[] }) {
  return (
    <Panel title={`Solicitudes de packs · ${pending.length}`} id="pending-h" action={<Pill tone="warn">Esperan tu confirmación de pago</Pill>}>
      <ul>
        {pending.map(p => <PendingRow key={p.id} p={p} />)}
      </ul>
    </Panel>
  )
}

function PendingRow({ p }: { p: AdminPurchase }) {
  const [method, setMethod] = useState<Method>('TRANSFER')
  const [isPending, startTransition] = useTransition()
  const [confirm, confirmDialog] = useConfirm()

  async function approve() {
    const ok = await confirm({
      title: `¿${p.gym.name} ya pagó?`,
      body: `Confirma que recibiste ${money(p.price, p.currency)}${p.billing === 'MONTHLY' ? ' de este mes' : ''}. Se le suman ${num(p.messages)} mensajes${p.billing === 'MONTHLY' ? ' por mes' : ''}.`,
      action: 'Sí, activar pack',
      tone: 'dark',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await approvePurchaseAction(p.id, method)
      if (res.error) toast.error(res.error)
      else toast.success(`Pack activado para ${p.gym.name}`)
    })
  }

  async function reject() {
    const ok = await confirm({
      title: '¿Rechazar la solicitud?',
      body: `${p.gym.name} pidió “${p.name}”. No se le suma ningún mensaje.`,
      action: 'Rechazar',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await rejectPurchaseAction(p.id)
      if (res.error) toast.error(res.error)
    })
  }

  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-adm-line-soft px-5 py-3.5 first:border-t-0">
      <span className="min-w-0 flex-1 basis-56">
        <span className="block text-sm font-bold">{p.gym.name}</span>
        <span className="block text-[13px] text-adm-muted">
          {p.name} · {num(p.messages)} mensajes{p.billing === 'MONTHLY' ? ' / mes' : ''} · {money(p.price, p.currency)}
          {p.billing === 'MONTHLY' ? ' / mes' : ''} · pedido el {new Date(p.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
        </span>
      </span>
      <label className="sr-only" htmlFor={`m-${p.id}`}>Método de pago</label>
      <select id={`m-${p.id}`} value={method} onChange={e => setMethod(e.target.value as Method)} disabled={isPending} className={cn(field.input, 'w-auto min-h-9')}>
        {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <button type="button" onClick={approve} disabled={isPending} className={btn.dark}>Pagado · activar</button>
      <button type="button" onClick={reject} disabled={isPending} className={btn.danger}>Rechazar</button>
      {confirmDialog}
    </li>
  )
}

function PlanLimitsPanel({ plans, gymCounts, cost }: { plans: SubscriptionPlan[]; gymCounts: Record<string, number>; cost: number }) {
  return (
    <Panel
      title="Límite mensual por plan"
      id="limits-h"
      action={<span className="text-[13px] text-adm-muted">Avisos, cumpleaños, vencimientos y pruebas · se reinicia el día 1</span>}
    >
      <div className={cn(PLAN_GRID, 'hidden border-b border-adm-line-soft bg-adm-subtle py-2.5 text-xs font-semibold text-adm-muted md:grid')} aria-hidden="true">
        <span>Plan</span><span>Mensajes / mes</span><span>Te cuesta por gym</span><span>Al agotarse</span><span />
      </div>
      <ul>
        {plans.map(p => <PlanLimitRow key={p.id} plan={p} gyms={gymCounts[p.key.toUpperCase()] ?? 0} cost={cost} />)}
      </ul>
    </Panel>
  )
}

function PlanLimitRow({ plan, gyms, cost }: { plan: SubscriptionPlan; gyms: number; cost: number }) {
  const [limit, setLimit] = useState(plan.monthlyMessageLimit == null ? '' : String(plan.monthlyMessageLimit))
  const [packsOn, setPacksOn] = useState(plan.messagePacksEnabled ?? true)
  const [isPending, startTransition] = useTransition()
  const parsed = limit === '' ? null : Number(limit)
  const dirty = parsed !== plan.monthlyMessageLimit || packsOn !== (plan.messagePacksEnabled ?? true)
  const autoOff = parsed === 0 && !packsOn && (plan.birthdayMessagesEnabled || plan.expiryRemindersEnabled)

  function save() {
    startTransition(async () => {
      const res = await updateSubscriptionPlanAction(plan.id, { monthlyMessageLimit: parsed, messagePacksEnabled: packsOn }, plan.key)
      if (res.error) toast.error(res.error)
      else toast.success(`Plan ${plan.label} actualizado`)
    })
  }

  return (
    <li className={cn(PLAN_GRID, 'grid grid-cols-2 gap-x-4 gap-y-3 border-t border-adm-line-soft py-4 first:border-t-0')}>
      <div className="col-span-2 md:col-span-1">
        <span className="block font-bold">{plan.label}</span>
        <span className="text-xs text-adm-muted">
          <span className="font-admin-mono">{plan.key}</span> · {gyms} gimnasio{gyms !== 1 ? 's' : ''}
        </span>
      </div>
      <div>
        <Cap>Mensajes / mes</Cap>
        <input
          inputMode="numeric"
          value={limit}
          onChange={e => setLimit(e.target.value.replace(/\D/g, '').slice(0, 7))}
          placeholder="Ilimitado"
          aria-label={`Mensajes por mes del plan ${plan.label}`}
          disabled={isPending}
          className={cn(field.input, 'text-right font-admin-mono')}
        />
      </div>
      <div>
        <Cap>Te cuesta por gym</Cap>
        <span className="flex min-h-11 items-center font-admin-mono text-sm">
          {parsed === null ? 'Sin tope' : cost ? usd(parsed * cost) : '—'}
        </span>
      </div>
      <div className="col-span-2 md:col-span-1">
        <Cap>Al agotarse</Cap>
        <span className="flex min-h-11 items-center gap-2.5">
          <Switch checked={packsOn} onChange={setPacksOn} label={`Ofrecer packs en el plan ${plan.label}`} disabled={isPending} />
          <span className="text-[13px]">{packsOn ? 'Pueden comprar packs' : 'Se frenan los envíos'}</span>
        </span>
      </div>
      <div className="col-span-2 flex md:col-span-1 md:justify-end">
        {dirty && (
          <button type="button" onClick={save} disabled={isPending} className={cn(btn.dark, 'w-full md:w-auto')}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        )}
      </div>
      {autoOff && (
        <p className={cn('col-span-2 flex items-center gap-1.5 text-xs font-semibold md:col-span-5', toneText.warn)}>
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          Con 0 mensajes y sin packs, a este plan no le llegan cumpleaños ni vencimientos.
        </p>
      )}
    </li>
  )
}

function PackRow({ pack, cost, planLabel, onEdit }: { pack: AdminPack; cost: number; planLabel: Map<string, string>; onEdit: () => void }) {
  const [isPending, startTransition] = useTransition()
  const m = margin(pack.price, pack.messages, cost)
  const monthly = pack.billing === 'MONTHLY'
  const [confirm, confirmDialog] = useConfirm()

  function toggle(next: boolean) {
    startTransition(async () => {
      const res = await togglePackAction(pack.id, next)
      if (res.error) toast.error(res.error)
    })
  }

  async function remove() {
    const ok = await confirm({
      title: '¿Eliminar el pack?',
      body: `“${pack.name}” deja de aparecer para los gimnasios. Las compras ya hechas no cambian.`,
      action: 'Eliminar pack',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await deletePackAction(pack.id)
      if (res.error) toast.error(res.error)
    })
  }

  return (
    <li className={cn(PACK_GRID, 'grid grid-cols-3 gap-x-4 gap-y-3 border-t border-adm-line-soft py-4 first:border-t-0')}>
      <div className={cn('col-span-3 md:col-span-1', !pack.isActive && 'opacity-60')}>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-bold">{pack.name}</span>
          <Pill tone={monthly ? 'ok' : 'neutral'}>{monthly ? 'Mensual' : 'Pago único'}</Pill>
        </span>
        <span className="mt-0.5 block text-xs text-adm-muted">{pack.planKeys.map(k => planLabel.get(k) ?? k).join(' · ') || 'Ningún plan'}</span>
      </div>
      <div className={cn(!pack.isActive && 'opacity-60')}>
        <Cap>Mensajes</Cap>
        <span className="font-admin-mono">{num(pack.messages)}</span>
        {monthly && <span className="text-xs text-adm-muted"> /mes</span>}
      </div>
      <div className={cn(!pack.isActive && 'opacity-60')}>
        <Cap>Precio</Cap>
        <span className="font-admin-mono">{money(pack.price, pack.currency)}</span>
        {monthly && <span className="text-xs text-adm-muted"> /mes</span>}
      </div>
      <div className={cn(!pack.isActive && 'opacity-60')}>
        <Cap>Margen</Cap>
        {cost ? (
          <span className={cn('font-admin-mono font-bold', toneText[marginTone(m)])}>
            {usd(m.gain)} <span className="font-semibold">· {m.pct}%</span>
          </span>
        ) : (
          <span className="text-xs text-adm-muted">Falta tu costo</span>
        )}
      </div>
      <div className="col-span-3 flex items-center justify-between gap-3 md:contents">
        <span className="flex items-center gap-2.5">
          <Switch checked={pack.isActive} onChange={toggle} label={`Activo: ${pack.name}`} disabled={isPending} />
          <span className="text-[13px] md:hidden">{pack.isActive ? 'Activo' : 'Oculto'}</span>
        </span>
        <span className="flex justify-end">
          <button type="button" onClick={onEdit} aria-label={`Editar ${pack.name}`} className={btn.icon}><Pencil className="size-4" /></button>
          <button type="button" onClick={remove} disabled={isPending} aria-label={`Eliminar ${pack.name}`} className={cn(btn.icon, 'hover:bg-adm-bad-bg hover:text-adm-bad-fg')}><Trash2 className="size-4" /></button>
        </span>
      </div>
      {confirmDialog}
    </li>
  )
}

function PackEditor({ pack, plans, cost, onClose }: { pack: AdminPack | null; plans: SubscriptionPlan[]; cost: number; onClose: () => void }) {
  const [name, setName] = useState(pack?.name ?? '')
  const [messages, setMessages] = useState(pack ? String(pack.messages) : '')
  const [price, setPrice] = useState(pack ? String(pack.price).replace('.', ',') : '')
  const [currency, setCurrency] = useState(pack?.currency ?? 'USD')
  const [billing, setBilling] = useState<'ONCE' | 'MONTHLY'>(pack?.billing ?? 'ONCE')
  const [planKeys, setPlanKeys] = useState<string[]>(pack?.planKeys ?? plans.filter(p => p.isActive).map(p => p.key))
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    ref.current?.querySelector('input')?.focus({ preventScroll: true })
  }, [])

  const msgs = Number(messages) || 0
  const amount = parseNum(price) || 0
  const m = margin(amount, msgs, cost)
  const tone = marginTone(m)

  function save() {
    const data: PackInput = { name, messages: msgs, price: amount, currency, billing, planKeys, isActive: pack?.isActive ?? true }
    startTransition(async () => {
      const res = await savePackAction(pack?.id ?? null, data)
      if (res.error) toast.error(res.error)
      else {
        toast.success(pack ? 'Pack actualizado' : `Pack "${name.trim()}" creado`)
        onClose()
      }
    })
  }

  return (
    <section ref={ref} aria-labelledby="pe-h" className="scroll-mt-6 rounded-2xl border-2 border-adm-ink bg-adm-surface p-5 sm:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pe-h" className="text-[22px] font-extrabold">{pack ? `Editar ${pack.name}` : 'Nuevo pack'}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className={cn(btn.line, 'min-h-11')}>Descartar</button>
          <button type="button" onClick={save} disabled={isPending || !name.trim() || msgs < 1 || amount <= 0 || planKeys.length === 0} className={btn.primary}>
            {isPending ? 'Guardando…' : pack ? 'Guardar pack' : 'Crear pack'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="min-w-0 flex-[2_1_220px]">
          <span className={field.label}>Nombre</span>
          <input value={name} onChange={e => setName(e.target.value.slice(0, 60))} placeholder="Ej. Pack 1.000" disabled={isPending} className={field.input} />
        </label>
        <label className="min-w-0 flex-[1_1_140px]">
          <span className={field.label}>Mensajes</span>
          <input inputMode="numeric" placeholder="1000" value={messages} onChange={e => setMessages(e.target.value.replace(/\D/g, '').slice(0, 7))} disabled={isPending} className={cn(field.input, 'font-admin-mono')} />
        </label>
        <label className="min-w-0 flex-[1_1_140px]">
          <span className={field.label}>Precio</span>
          <input inputMode="decimal" placeholder="27" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d,.]/g, '').slice(0, 10))} disabled={isPending} className={cn(field.input, 'font-admin-mono')} />
        </label>
        <label className="min-w-0 flex-[0_1_110px]">
          <span className={field.label}>Moneda</span>
          <select value={currency} onChange={e => setCurrency(e.target.value)} disabled={isPending} className={field.input}>
            {['USD', 'ARS', 'EUR', 'BRL', 'MXN'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {/* Each option carries its own description, so picking one never resizes the form */}
      <fieldset className="min-w-0">
        <legend className={field.label}>Tipo de cobro</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {BILLING_OPTIONS.map(([v, label, desc]) => (
            <label
              key={v}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
                billing === v ? 'border-adm-ink bg-adm-chip' : 'border-adm-line hover:border-adm-ink',
              )}
            >
              <input
                type="radio"
                name="pack-billing"
                value={v}
                checked={billing === v}
                onChange={() => setBilling(v)}
                disabled={isPending}
                className="mt-0.5 size-4 shrink-0 accent-[#0e7a70]"
              />
              <span>
                <span className="block text-sm font-bold">{label}</span>
                <span className="mt-0.5 block text-xs text-adm-muted">{desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={field.label}>Disponible para</legend>
        <div className="flex flex-wrap gap-2">
          {plans.map(p => (
            <label
              key={p.key}
              className={cn(
                'inline-flex h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-3.5 text-[13px] font-semibold transition-colors',
                planKeys.includes(p.key) ? 'border-adm-ink bg-adm-chip' : 'border-adm-line text-adm-muted hover:border-adm-ink',
              )}
            >
              <input
                type="checkbox"
                checked={planKeys.includes(p.key)}
                onChange={e => setPlanKeys(ks => e.target.checked ? [...ks, p.key] : ks.filter(k => k !== p.key))}
                disabled={isPending}
                className="size-4 accent-[#0e7a70]"
              />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      {msgs > 0 && amount > 0 && (
        <div
          role="status"
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm',
            tone === 'bad' ? 'border-adm-bad-line bg-adm-bad-bg text-adm-bad-fg' : tone === 'warn' ? 'border-adm-warn-line bg-adm-warn-bg text-adm-warn-fg' : 'border-adm-ok-line bg-adm-ok-bg text-adm-ok-fg',
          )}
        >
          <span className="flex-1 basis-64">
            <strong>
              {tone === 'bad' ? 'Perderías plata con este pack.' : tone === 'warn' ? `Margen bajo: ${m.pct}%.` : `Ganas ${money(m.gain, currency)}${billing === 'MONTHLY' ? ' por mes' : ''} (${m.pct}%).`}
            </strong>{' '}
            Te cuesta {usd(m.spend)} en mensajes.
          </span>
          <span className="font-admin-mono text-[13px]">{money(amount / msgs, currency)} por mensaje para el gym</span>
        </div>
      )}
      {cost === 0 && <p className={field.hint}>Carga arriba lo que te cuesta cada mensaje para ver el margen real.</p>}
    </section>
  )
}

const STATUS: Record<Exclude<AdminPurchase['status'], 'PENDING'>, [string, Tone]> = {
  ACTIVE: ['Activa', 'ok'],
  CANCELLED: ['Anulada', 'neutral'],
  REJECTED: ['Rechazada', 'bad'],
}
const shortDate = (d: string) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })

function SalesPanel({ sales }: { sales: AdminPurchase[] }) {
  const monthly = sales.filter(p => p.status === 'ACTIVE' && p.billing === 'MONTHLY').length
  return (
    <Panel
      title={`Ventas de packs · ${sales.length}`}
      id="sales-h"
      action={monthly > 0 ? (
        <span className="text-[13px] text-adm-muted">
          {monthly === 1 ? '1 extra mensual activo: cóbralo' : `${monthly} extras mensuales activos: cóbralos`} con la suscripción
        </span>
      ) : undefined}
    >
      <ul>
        {sales.map(p => <SaleRow key={p.id} p={p} />)}
      </ul>
    </Panel>
  )
}

function SaleRow({ p }: { p: AdminPurchase }) {
  const [isPending, startTransition] = useTransition()
  const status = STATUS[p.status as keyof typeof STATUS]
  const once = p.billing === 'ONCE'
  const [confirm, confirmDialog] = useConfirm()

  async function cancel() {
    const ok = await confirm(once
      ? { title: '¿Anular la venta?', body: `A ${p.gym.name} se le quitan los ${num(p.messages)} mensajes del pack, solo los que todavía no usó.`, action: 'Anular venta' }
      : { title: '¿Cancelar el extra mensual?', body: `${p.gym.name} deja de sumar ${num(p.messages)} mensajes por mes.`, action: 'Cancelar extra' })
    if (!ok) return
    startTransition(async () => {
      const res = await cancelPurchaseAction(p.id)
      if (res.error) toast.error(res.error)
      else toast.success(once ? 'Venta anulada' : 'Extra mensual cancelado')
    })
  }

  async function remove() {
    const ok = await confirm({
      title: '¿Eliminar la venta?',
      body: p.status === 'ACTIVE'
        ? `La venta a ${p.gym.name} desaparece del historial y de lo vendido${once ? `, y se le quitan los ${num(p.messages)} mensajes que no usó` : ', y deja de sumar mensajes por mes'}. No se puede deshacer.`
        : `La venta a ${p.gym.name} desaparece del historial. No se puede deshacer.`,
      action: 'Eliminar venta',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await deletePurchaseAction(p.id)
      if (res.error) toast.error(res.error)
      else toast.success('Venta eliminada')
    })
  }

  return (
    // Phones: trash beside the name, void button below; desktop: both on the right
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-t border-adm-line-soft px-5 py-3.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
      <span className={cn('min-w-0', p.status !== 'ACTIVE' && 'opacity-70')}>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">{p.gym.name}</span>
          <Pill tone={status[1]}>{status[0]}</Pill>
        </span>
        <span className="mt-0.5 block text-[13px] text-adm-muted">
          {p.name} · {num(p.messages)} mensajes{once ? '' : ' / mes'} · {money(p.price, p.currency)}{once ? '' : ' / mes'}
          {p.paidAt ? ` · pagado el ${shortDate(p.paidAt)}` : ` · pedido el ${shortDate(p.createdAt)}`}
        </span>
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        aria-label={`Eliminar venta a ${p.gym.name}`}
        title="Eliminar venta"
        className={cn(btn.icon, 'hover:bg-adm-bad-bg hover:text-adm-bad-fg sm:col-start-3 sm:row-start-1')}
      >
        <Trash2 className="size-4" />
      </button>
      {p.status === 'ACTIVE' && (
        <button type="button" onClick={cancel} disabled={isPending} className={cn(btn.danger, 'col-span-2 justify-self-start sm:col-span-1 sm:col-start-2 sm:row-start-1')}>
          {once ? 'Anular' : 'Cancelar'}
        </button>
      )}
      {confirmDialog}
    </li>
  )
}
