'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, MapPin, Globe, Clock, CreditCard, ShoppingBag, Calendar, Star, ArrowRightLeft, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Gym } from '@/types'
import { EmptyState, GymMark, Pill, Switch, btn, chip, field, td, th, type Tone } from '@/components/admin/ui'
import { toggleGymActiveAction, fetchGymModalDataAction, changeGymPlanAction, bulkDeleteGymsAction, type GymModalData, type ProratedResult } from './actions'
import type { SubscriptionPlan } from './new/page'

const PAGE_SIZE = 25

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function daysUntil(iso: string) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.ceil((new Date(iso).getTime() - today) / 86_400_000)
}

const SUB: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Activa', tone: 'ok' },
  TRIAL: { label: 'Prueba', tone: 'info' },
  GRACE: { label: 'Prórroga', tone: 'warn' },
  SUSPENDED: { label: 'Suspendida', tone: 'bad' },
}

type Filter = 'all' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'off'

const FILTERS: { key: Filter; label: string; test: (g: Gym) => boolean }[] = [
  { key: 'all', label: 'Todos', test: () => true },
  { key: 'ACTIVE', label: 'Activas', test: g => g.subscriptionStatus === 'ACTIVE' || g.subscriptionStatus === 'TRIAL' },
  { key: 'GRACE', label: 'En prórroga', test: g => g.subscriptionStatus === 'GRACE' },
  { key: 'SUSPENDED', label: 'Suspendidas', test: g => g.subscriptionStatus === 'SUSPENDED' },
  { key: 'off', label: 'Inactivos', test: g => !g.isActive },
]

function ExpiryCell({ gym }: { gym: Gym }) {
  if (!gym.subscriptionExpiresAt) return <span className="text-adm-muted">—</span>
  const days = daysUntil(gym.subscriptionExpiresAt)
  const late = gym.subscriptionStatus === 'GRACE' || gym.subscriptionStatus === 'SUSPENDED' || days < 0
  return (
    <span
      className={cn('font-admin-mono text-[13px]', late ? 'text-adm-bad-fg' : days <= 7 ? 'text-adm-warn-fg font-bold' : '')}
      title={days >= 0 ? `Faltan ${days} días` : `Venció hace ${-days} días`}
    >
      {formatDate(gym.subscriptionExpiresAt)}
    </span>
  )
}

function ProratedBreakdown({ p, currency, onDone }: { p: ProratedResult; currency: string; onDone: () => void }) {
  const fmt = (n: number) => `${currency} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
  return (
    <div className="space-y-2 rounded-xl border border-adm-ok-line bg-adm-ok-bg p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-adm-ok-fg">Detalle del cambio</p>
      <div className="space-y-1">
        {([
          ['Crédito a favor', fmt(p.creditAmount / 100)],
          ['Precio nuevo plan', fmt(p.newPlanPrice / 100)],
          ['Crédito aplicado', `- ${fmt(p.creditApplied / 100)}`],
        ] as const).map(([label, value]) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-adm-muted">{label}</span>
            <span className="font-semibold">{value}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-adm-ok-line pt-1.5 text-sm font-black">
          <span>Total cobrado</span>
          <span className="font-admin-mono text-adm-ok-fg">{fmt(p.amountDue / 100)}</span>
        </div>
      </div>
      <button type="button" onClick={onDone} className={btn.link}>Listo</button>
    </div>
  )
}

export function GymTable({ gyms, plans, initialQuery = '' }: { gyms: Gym[]; plans: SubscriptionPlan[]; initialQuery?: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [selected, setSelected] = useState<Gym | null>(null)
  const [modalData, setModalData] = useState<GymModalData | null>(null)
  const [loadingModal, setLoadingModal] = useState(false)

  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)

  // Optimistic active toggles
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({})
  const rows = useMemo(
    () => gyms.map(g => (g.id in activeOverrides ? { ...g, isActive: activeOverrides[g.id] } : g)),
    [gyms, activeOverrides],
  )

  const q = query.trim().toLowerCase()
  const searched = rows.filter(g =>
    !q ||
    g.name.toLowerCase().includes(q) ||
    g.slug.toLowerCase().includes(q) ||
    g.owner?.email.toLowerCase().includes(q) ||
    g.owner?.name.toLowerCase().includes(q),
  )
  const visible = searched.filter(FILTERS.find(f => f.key === filter)!.test)
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Bulk delete state
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  function toggleCheck(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allPageChecked = pageRows.length > 0 && pageRows.every(g => checkedIds.has(g.id))
  const somePageChecked = pageRows.some(g => checkedIds.has(g.id))

  function toggleAll() {
    setCheckedIds(prev => {
      const next = new Set(prev)
      pageRows.forEach(g => (allPageChecked ? next.delete(g.id) : next.add(g.id)))
      return next
    })
  }

  async function handleBulkDelete() {
    setIsBulkDeleting(true)
    const { deleted, errors } = await bulkDeleteGymsAction(Array.from(checkedIds))
    setIsBulkDeleting(false)
    setBulkConfirmOpen(false)
    setCheckedIds(new Set())
    if (deleted > 0) {
      toast.success(`${deleted} gimnasio${deleted !== 1 ? 's' : ''} eliminado${deleted !== 1 ? 's' : ''}`)
      startTransition(() => router.refresh())
    }
    if (errors > 0) toast.error(`Error al eliminar ${errors} gimnasio${errors !== 1 ? 's' : ''}`)
  }

  // Change plan state
  const [showChangePlan, setShowChangePlan] = useState(false)
  const [selectedPlanKey, setSelectedPlanKey] = useState('')
  const [changePlanMethod, setChangePlanMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH')
  const [changePlanNotes, setChangePlanNotes] = useState('')
  const [proration, setProration] = useState<ProratedResult | null>(null)
  const [isPendingPlan, startPlanTransition] = useTransition()
  const [planError, setPlanError] = useState<string | null>(null)

  function handleToggle(gymId: string, active: boolean) {
    setActiveOverrides(prev => ({ ...prev, [gymId]: active }))
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
        const data = await fetchGymModalDataAction(selected.id)
        setModalData(data)
      }
    })
  }

  const availableSubPlans = modalData?.subPlans.filter(
    p => p.key.toUpperCase() !== modalData.subscription?.subscriptionPlan?.toUpperCase()
  ) ?? []

  const planLabel = (key: string) => plans.find(p => p.key.toUpperCase() === key?.toUpperCase())?.label ?? key

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => { setFilter(f.key); setPage(1) }}
              className={chip(filter === f.key)}
            >
              {f.label}
              <span className="font-admin-mono text-xs opacity-75">{searched.filter(f.test).length}</span>
            </button>
          ))}
        </div>
        <label className="relative flex min-w-[220px] flex-[0_1_320px] items-center">
          <span className="sr-only">Buscar gimnasio</span>
          <Search className="pointer-events-none absolute left-3 size-4 text-adm-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }}
            placeholder="Nombre, slug o dueño"
            className={cn(field.input, 'min-h-10 pl-9')}
          />
        </label>
      </div>

      {/* Bulk action bar */}
      {checkedIds.size > 0 && (
        <div className="adm-night flex flex-wrap items-center gap-3 rounded-xl bg-adm-night py-2.5 pl-4.5 pr-3 text-white">
          <span className="flex-1 text-sm font-semibold">
            {checkedIds.size} gimnasio{checkedIds.size !== 1 ? 's' : ''} seleccionado{checkedIds.size !== 1 ? 's' : ''}
          </span>
          <button type="button" onClick={() => setBulkConfirmOpen(true)} className={btn.dangerSolid}>
            Eliminar
          </button>
          <button type="button" onClick={() => setCheckedIds(new Set())} className="min-h-9 px-2.5 text-[13px] text-[#a3a39d] hover:text-white">
            Cancelar
          </button>
        </div>
      )}

      <section aria-label="Listado de gimnasios" className="overflow-hidden rounded-2xl border border-adm-line bg-adm-surface">
        {pageRows.length === 0 ? (
          <EmptyState icon={<Building2 className="size-12" />}>
            {gyms.length === 0 ? 'Todavía no hay gimnasios registrados.' : 'Ningún gimnasio coincide con el filtro.'}
          </EmptyState>
        ) : (
          <>
            {/* Mobile list */}
            <ul className="md:hidden">
              {pageRows.map(gym => (
                <li key={gym.id} className={cn('flex items-center gap-3 border-t border-adm-line-soft px-4 py-3.5 first:border-t-0', checkedIds.has(gym.id) && 'bg-[#fffde0] dark:bg-[#24230f]')}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(gym.id)}
                    onChange={() => toggleCheck(gym.id)}
                    aria-label={`Seleccionar ${gym.name}`}
                    className="size-[18px] shrink-0 cursor-pointer accent-adm-ink"
                  />
                  <button type="button" onClick={() => openModal(gym)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <GymMark name={gym.name} logoUrl={gym.logoUrl} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{gym.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {SUB[gym.subscriptionStatus] && <Pill tone={SUB[gym.subscriptionStatus].tone}>{SUB[gym.subscriptionStatus].label}</Pill>}
                        <span className="text-xs text-adm-muted">{planLabel(gym.subscriptionPlan)}</span>
                      </span>
                    </span>
                  </button>
                  <Switch checked={gym.isActive} onChange={v => handleToggle(gym.id, v)} label={`Activo: ${gym.name}`} />
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className={cn(th, 'w-5 pl-5 pr-2')}>
                      <input
                        type="checkbox"
                        checked={allPageChecked}
                        ref={el => { if (el) el.indeterminate = somePageChecked && !allPageChecked }}
                        onChange={toggleAll}
                        aria-label="Seleccionar todos"
                        className="size-[18px] cursor-pointer accent-adm-ink"
                      />
                    </th>
                    <th scope="col" className={th}>Gimnasio</th>
                    <th scope="col" className={th}>Dueño</th>
                    <th scope="col" className={th}>Plan</th>
                    <th scope="col" className={th}>Suscripción</th>
                    <th scope="col" className={th}>Vence</th>
                    <th scope="col" className={th}>Activo</th>
                    <th scope="col" className={cn(th, 'pr-5')}><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(gym => {
                    const checked = checkedIds.has(gym.id)
                    const sub = SUB[gym.subscriptionStatus]
                    return (
                      <tr
                        key={gym.id}
                        onClick={() => openModal(gym)}
                        className={cn('cursor-pointer transition-colors', checked ? 'bg-[#fffde0] dark:bg-[#24230f]' : 'hover:bg-adm-subtle')}
                      >
                        <td className={cn(td, 'pl-5 pr-2')} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCheck(gym.id)}
                            aria-label={`Seleccionar ${gym.name}`}
                            className="size-[18px] cursor-pointer accent-adm-ink"
                          />
                        </td>
                        <td className={td}>
                          <div className="flex items-center gap-3">
                            <GymMark name={gym.name} logoUrl={gym.logoUrl} />
                            <div className="min-w-0">
                              <p className="truncate font-bold">{gym.name}</p>
                              <p className="font-admin-mono text-xs text-adm-muted">/{gym.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className={td}>
                          {gym.owner ? (
                            <div className="min-w-0">
                              <p className="truncate font-medium">{gym.owner.name}</p>
                              <p className="truncate text-xs text-adm-muted">{gym.owner.email}</p>
                            </div>
                          ) : (
                            <span className="text-adm-muted">—</span>
                          )}
                        </td>
                        <td className={cn(td, 'font-semibold')}>{planLabel(gym.subscriptionPlan)}</td>
                        <td className={td}>{sub ? <Pill tone={sub.tone}>{sub.label}</Pill> : '—'}</td>
                        <td className={td}><ExpiryCell gym={gym} /></td>
                        <td className={td} onClick={e => e.stopPropagation()}>
                          <Switch checked={gym.isActive} onChange={v => handleToggle(gym.id, v)} label={`Activo: ${gym.name}`} />
                        </td>
                        <td className={cn(td, 'pr-5')} onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Link href={`/gym/${gym.slug}/dashboard`} className={btn.dark}>Entrar</Link>
                            <Link href={`/admin/gyms/${gym.id}`} className={btn.line}>Detalle</Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-line-soft px-5 py-3.5 text-[13px] text-adm-muted">
          <span>Mostrando {pageRows.length} de {visible.length}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className={btn.line}>
                <ChevronLeft className="size-4" aria-hidden="true" /> Anterior
              </button>
              <span className="px-2 font-admin-mono">{currentPage} / {totalPages}</span>
              <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages} className={btn.line}>
                Siguiente <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Bulk delete confirm */}
      <Dialog open={bulkConfirmOpen} onOpenChange={v => { if (!v) setBulkConfirmOpen(false) }}>
        <DialogContent className="admin-surface max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar {checkedIds.size} gimnasio{checkedIds.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Se eliminan permanentemente estos gimnasios y <strong>todos sus datos</strong> (miembros, planes, pagos, asistencias). No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-1 max-h-52 space-y-1 overflow-y-auto">
            {gyms.filter(g => checkedIds.has(g.id)).map(g => (
              <li key={g.id} className="flex items-center gap-2 rounded-lg border border-adm-bad-line bg-adm-bad-bg px-3 py-2">
                <span className="flex-1 truncate text-sm font-medium">{g.name}</span>
                <span className="shrink-0 font-admin-mono text-xs text-adm-muted">/{g.slug}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <button onClick={handleBulkDelete} disabled={isBulkDeleting} className={cn(btn.dangerSolid, 'flex-1 min-h-10')}>
              {isBulkDeleting ? 'Eliminando…' : `Eliminar ${checkedIds.size}`}
            </button>
            <button onClick={() => setBulkConfirmOpen(false)} disabled={isBulkDeleting} className={cn(btn.line, 'flex-1 min-h-10')}>
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick view */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) closeModal() }}>
        <DialogContent className="admin-surface max-h-[90vh] overflow-y-auto sm:max-w-lg" showCloseButton>
          {selected && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <GymMark name={selected.name} logoUrl={selected.logoUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-xl font-extrabold tracking-tight">{selected.name}</DialogTitle>
                  <p className="font-admin-mono text-xs text-adm-muted">/{selected.slug}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Pill tone={selected.isActive ? 'ok' : 'neutral'}>{selected.isActive ? 'Activo' : 'Inactivo'}</Pill>
                    {modalData?.subscription && SUB[modalData.subscription.subscriptionStatus] && (
                      <Pill tone={SUB[modalData.subscription.subscriptionStatus].tone}>
                        Suscripción {SUB[modalData.subscription.subscriptionStatus].label.toLowerCase()}
                      </Pill>
                    )}
                  </div>
                </div>
              </div>

              {selected.owner && (
                <div className="rounded-xl border border-adm-line-soft bg-adm-subtle px-4 py-3">
                  <p className="mb-1 text-xs font-semibold text-adm-muted">Dueño</p>
                  <p className="text-sm font-bold">{selected.owner.name}</p>
                  <p className="text-xs text-adm-muted">{selected.owner.email}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {([
                  [CreditCard, 'Plan', planLabel(modalData?.subscription?.subscriptionPlan ?? selected.subscriptionPlan),
                    modalData?.subscription?.subscriptionExpiresAt ? `Vence ${formatDate(modalData.subscription.subscriptionExpiresAt)}` : null],
                  [ShoppingBag, 'Tienda', selected.storeEnabled ? 'Habilitada' : 'Deshabilitada', null],
                  ...(selected.country ? [[Globe, 'País', selected.country, null]] : []),
                  [Clock, 'Zona horaria', selected.timezone, null],
                  ...(selected.address ? [[MapPin, 'Dirección', selected.address, null]] : []),
                  [Calendar, 'Creado', formatDate(selected.createdAt), null],
                ] as [typeof CreditCard, string, string, string | null][]).map(([Icon, label, value, sub]) => (
                  <div key={label} className="flex items-center gap-2.5 rounded-xl border border-adm-line-soft bg-adm-subtle px-3 py-2.5">
                    <Icon className="size-4 shrink-0 text-adm-muted" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-adm-muted">{label}</p>
                      <p className="truncate text-sm font-bold">{value}</p>
                      {sub && <p className="text-[11px] text-adm-muted">{sub}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {loadingModal && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-adm-muted" aria-label="Cargando" />
                </div>
              )}

              {modalData && (
                <>
                  <div className="overflow-hidden rounded-xl border border-adm-line">
                    <div className="flex items-center justify-between border-b border-adm-line-soft bg-adm-subtle px-4 py-3">
                      <span className="text-[13px] font-bold">Miembros recientes</span>
                      <Link href={`/gym/${selected.slug}/members`} className={btn.link}>Ver todos</Link>
                    </div>
                    {modalData.members.length === 0 ? (
                      <p className="px-4 py-5 text-center text-xs text-adm-muted">Sin miembros registrados</p>
                    ) : (
                      <ul>
                        {modalData.members.map(m => (
                          <li key={m.id} className="flex items-center gap-3 border-t border-adm-line-soft px-4 py-2.5 first:border-t-0">
                            <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-adm-chip text-[10px] font-bold">
                              {m.photoUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={m.photoUrl} alt="" className="size-full object-cover" />
                                : <>{m.firstName[0]}{m.lastName[0]}</>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold">{m.firstName} {m.lastName}</p>
                              <p className="truncate text-[11px] text-adm-muted">{m.email}</p>
                            </div>
                            <Pill tone={m.isActive ? 'ok' : 'neutral'}>{m.isActive ? 'Activo' : 'Inactivo'}</Pill>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {modalData.plans.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-adm-line">
                      <div className="flex items-center justify-between border-b border-adm-line-soft bg-adm-subtle px-4 py-3">
                        <span className="text-[13px] font-bold">Planes que ofrece</span>
                        <span className="text-[11px] text-adm-muted">{modalData.plans.length} plan{modalData.plans.length !== 1 ? 'es' : ''}</span>
                      </div>
                      <ul>
                        {modalData.plans.map(p => (
                          <li key={p.id} className="flex items-center justify-between border-t border-adm-line-soft px-4 py-2.5 first:border-t-0">
                            <div className="flex min-w-0 items-center gap-1.5">
                              {p.isFeatured && <Star className="size-3 shrink-0 fill-adm-brand text-adm-warn-fg" aria-label="Destacado" />}
                              <p className="truncate text-xs font-semibold">{p.name}</p>
                              <span className="shrink-0 text-[11px] text-adm-muted">{p.durationDays}d</span>
                            </div>
                            <p className="shrink-0 font-admin-mono text-xs font-bold">{p.currency} {p.price.toLocaleString('es-AR')}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-xl border border-adm-line">
                    <button
                      type="button"
                      aria-expanded={showChangePlan}
                      onClick={() => { setShowChangePlan(v => !v); setProration(null); setPlanError(null) }}
                      className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-bold transition-colors hover:bg-adm-subtle"
                    >
                      <span className="flex items-center gap-2">
                        <ArrowRightLeft className="size-3.5" aria-hidden="true" />
                        Cambiar plan de suscripción
                      </span>
                      <ChevronRight className={cn('size-4 text-adm-muted transition-transform', showChangePlan && 'rotate-90')} aria-hidden="true" />
                    </button>

                    {showChangePlan && (
                      <div className="space-y-3 border-t border-adm-line-soft p-4">
                        {proration ? (
                          <ProratedBreakdown
                            p={proration}
                            currency={modalData.subPlans.find(p => p.key.toUpperCase() === selectedPlanKey.toUpperCase())?.currency ?? 'USD'}
                            onDone={() => { setProration(null); setShowChangePlan(false); setSelectedPlanKey('') }}
                          />
                        ) : (
                          <form onSubmit={handleChangePlan} className="space-y-3">
                            {availableSubPlans.length === 0 ? (
                              <p className="text-xs text-adm-muted">No hay otros planes disponibles.</p>
                            ) : (
                              <div role="radiogroup" aria-label="Nuevo plan" className="space-y-1.5">
                                {availableSubPlans.map(p => (
                                  <button
                                    key={p.key}
                                    type="button"
                                    role="radio"
                                    aria-checked={selectedPlanKey === p.key}
                                    onClick={() => setSelectedPlanKey(p.key)}
                                    className={cn(
                                      'flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left text-[13px] transition-colors',
                                      selectedPlanKey === p.key ? 'border-2 border-adm-ink bg-adm-subtle' : 'border border-adm-line hover:border-adm-ink',
                                    )}
                                  >
                                    <span className="font-semibold">{p.label ?? p.key}</span>
                                    <span className="font-admin-mono font-bold">{p.currency} {parseFloat(String(p.price)).toLocaleString('es-AR')}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {availableSubPlans.length > 0 && (
                              <>
                                <label className="block">
                                  <span className={field.label}>Método de pago</span>
                                  <select
                                    value={changePlanMethod}
                                    onChange={e => setChangePlanMethod(e.target.value as typeof changePlanMethod)}
                                    disabled={isPendingPlan}
                                    className={field.input}
                                  >
                                    <option value="CASH">Efectivo</option>
                                    <option value="CARD">Tarjeta</option>
                                    <option value="TRANSFER">Transferencia</option>
                                    <option value="OTHER">Otro</option>
                                  </select>
                                </label>
                                <label className="block">
                                  <span className={field.label}>Notas (opcional)</span>
                                  <input
                                    type="text"
                                    value={changePlanNotes}
                                    onChange={e => setChangePlanNotes(e.target.value)}
                                    disabled={isPendingPlan}
                                    className={field.input}
                                  />
                                </label>
                                {planError && <p className={field.error}>{planError}</p>}
                                <button type="submit" disabled={isPendingPlan || !selectedPlanKey} className={cn(btn.dark, 'w-full min-h-10')}>
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

              <div className="flex gap-2">
                <Link href={`/admin/gyms/${selected.id}`} className={cn(btn.line, 'min-h-11 flex-1')}>Ver detalle</Link>
                <Link href={`/gym/${selected.slug}/dashboard`} className={cn(btn.primary, 'flex-1')}>Entrar al panel</Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
