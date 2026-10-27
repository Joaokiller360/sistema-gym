'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, IdCard, Search } from 'lucide-react'
import { MembershipWithRelations, Plan } from '@/types'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { cn } from '@/lib/utils'
import { FILTERS, matchesFilter, membershipView, type FilterKey } from './membershipView'
import { MembershipPanel } from './MembershipPanel'
import { useLocale, useT } from '@/i18n/client'
import { membershipsMessages } from './messages'

const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(200px,2fr)_minmax(140px,1.3fr)_minmax(160px,1.5fr)_96px_20px] gap-4 items-center'

function isFilterKey(v: string | undefined): v is FilterKey {
  return FILTERS.some(f => f === v)
}

export function MembershipsBoard({
  gymSlug,
  memberships,
  plans,
  canManage,
  initialStatus,
  initialPlanId,
}: {
  gymSlug: string
  memberships: MembershipWithRelations[]
  plans: Plan[]
  canManage: boolean
  initialStatus?: string
  initialPlanId?: string
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>(isFilterKey(initialStatus) ? initialStatus : 'ACTIVE')
  const [planId, setPlanId] = useState(initialPlanId ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const locale = useLocale()
  const { board: t, view: tv } = useT(membershipsMessages)

  const rows = useMemo(() => {
    const now = new Date().getTime()
    return memberships.map(m => ({ m, view: membershipView(m, now, locale) }))
  }, [memberships, locale])

  const byPlan = rows.filter(r => !planId || r.m.planId === planId)

  const counts = useMemo(() => {
    const c = Object.fromEntries(FILTERS.map(f => [f, 0])) as Record<FilterKey, number>
    for (const r of byPlan) for (const f of FILTERS) if (matchesFilter(r.m, r.view, f)) c[f]++
    return c
  }, [byPlan])

  const q = query.trim().toLowerCase()
  const visible = byPlan.filter(({ m, view }) =>
    matchesFilter(m, view, filter) &&
    (!q || `${m.member.firstName} ${m.member.lastName} ${m.member.email} ${m.member.phone ?? ''} ${m.plan.name}`.toLowerCase().includes(q)),
  )
  const selected = visible.find(r => r.m.id === selectedId) ?? (mobileOpen ? null : visible[0]) ?? null
  const plansInUse = plans.filter(p => p.isActive || memberships.some(m => m.planId === p.id))

  function select(id: string) {
    setSelectedId(id)
    // Below lg the side panel is hidden: show it as a dialog instead
    if (window.matchMedia('(max-width: 1023px)').matches) setMobileOpen(true)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.active(counts.ACTIVE)}
          {counts.expiring > 0 && ` · ${t.expiring(counts.expiring)}`}
          {counts.EXPIRED > 0 && ` · ${t.expired(counts.EXPIRED)}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            type="search"
            aria-label={t.search}
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-11 rounded-xl pl-9"
            fieldType="search"
          />
        </div>
        <label className="sr-only" htmlFor="plan-filter">{t.plan}</label>
        <select
          id="plan-filter"
          value={planId}
          onChange={e => setPlanId(e.target.value)}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
        >
          <option value="">{t.allPlans}</option>
          {plansInUse.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div role="tablist" aria-label={t.filter} className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => {
          const on = filter === f
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-bold transition-colors',
                on
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
              )}
            >
              {tv.filters[f]}
              <span className={cn(
                'rounded-full px-1.5 py-px text-xs',
                on ? 'bg-white/20 text-white dark:bg-black/10 dark:text-black' : 'bg-zinc-100 text-zinc-600',
              )}>
                {counts[f]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col items-start gap-5 lg:flex-row">
        <section aria-label={t.list} className="w-full min-w-0 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className={cn(ROW_GRID, 'hidden border-b border-zinc-100 px-5 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500 md:grid')}>
            <span>{t.colMember}</span><span>{t.colPlan}</span><span>{t.colRemaining}</span><span>{t.colStatus}</span><span />
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <IdCard className="h-10 w-10 text-zinc-300" />
              <p className="font-bold">{memberships.length === 0 ? t.noneYet : t.noMatch}</p>
              <p className="text-sm text-zinc-500">
                {memberships.length === 0 ? t.noneYetHint : t.noMatchHint}
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5 p-1.5">
              {visible.map(({ m, view }) => {
                const on = selected?.m.id === m.id
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => select(m.id)}
                      aria-pressed={on}
                      className={cn(
                        ROW_GRID,
                        'min-h-[60px] w-full rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                        on ? 'border-[#1fad9d] bg-[#1fad9d]/5' : 'border-transparent hover:bg-zinc-50',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold',
                          m.status === 'ACTIVE' ? 'bg-[#1fad9d]/15 text-[#0a6158] dark:text-[#5fd4c4]' : 'bg-zinc-100 text-zinc-600',
                        )}>
                          {`${m.member.firstName[0] ?? ''}${m.member.lastName[0] ?? ''}`.toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-bold">{m.member.firstName} {m.member.lastName}</span>
                          <span className="block truncate text-[13px] text-zinc-500 md:hidden">{m.plan.name} · {view.remainingLabel}</span>
                          <span className="hidden truncate text-[13px] text-zinc-500 md:block">{m.member.email}</span>
                        </span>
                      </span>
                      <span className="hidden min-w-0 md:block">
                        <span className="block truncate text-sm font-semibold">{m.plan.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{view.kindLabel}</span>
                      </span>
                      <span className="hidden flex-col gap-1.5 md:flex">
                        <span className={cn('text-[13px] font-semibold', view.expiring ? 'text-amber-700' : 'text-zinc-700')}>{view.remainingLabel}</span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                          <span className={cn('block h-full rounded-full', view.barClass)} style={{ width: `${Math.round(view.pct * 100)}%` }} />
                        </span>
                      </span>
                      <span className="justify-self-start"><StatusBadge status={m.status} /></span>
                      <ChevronRight className="hidden h-4 w-4 text-zinc-400 md:block" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="border-t border-zinc-100 px-5 py-3 text-[13px] text-zinc-500">
            {t.showing(visible.length, memberships.length)}
          </div>
        </section>

        {selected && (
          <div className="hidden w-full lg:block lg:w-[400px] lg:shrink-0 lg:sticky lg:top-6">
            <MembershipPanel
              key={selected.m.id}
              gymSlug={gymSlug}
              membership={selected.m}
              view={selected.view}
              plans={plans}
              canManage={canManage}
            />
          </div>
        )}
      </div>

      <Dialog open={mobileOpen && !!selected} onOpenChange={setMobileOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-md lg:hidden">
          <DialogTitle className="sr-only">{t.detail}</DialogTitle>
          {selected && (
            <MembershipPanel
              key={selected.m.id}
              gymSlug={gymSlug}
              membership={selected.m}
              view={selected.view}
              plans={plans}
              canManage={canManage}
              bare
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
