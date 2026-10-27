'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CreditCard, Plus, Search, UserCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { memberView, STATUS_FILTERS, type MemberRow, type StatusKey } from './memberStatus'
import { MemberPanel } from './MemberPanel'
import { useLocale, useT } from '@/i18n/client'
import { memberStatusMessages, membersMessages } from './messages'

const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(200px,2.2fr)_minmax(130px,1.3fr)_minmax(150px,1.5fr)_minmax(90px,0.9fr)_104px] gap-4 items-center'

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function MembersBoard({
  members,
  gymSlug,
  paramsString,
  newMemberHref,
  newPaymentHref,
  initialQuery = '',
}: {
  members: MemberRow[]
  gymSlug: string
  paramsString: string
  newMemberHref: string
  newPaymentHref: string
  initialQuery?: string
}) {
  const router = useRouter()
  const locale = useLocale()
  const t = useT(membersMessages).board
  const filterLabels = useT(memberStatusMessages).filters
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<StatusKey | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const now = new Date()
    return members.map(m => ({ member: m, view: memberView(m, now, locale) }))
  }, [members, locale])

  const counts = useMemo(() => {
    const c: Record<StatusKey | 'all', number> = { all: rows.length, activo: 0, atencion: 0, vencido: 0, sinplan: 0, inactivo: 0 }
    for (const r of rows) c[r.view.key]++
    return c
  }, [rows])

  const q = query.trim().toLowerCase()
  const visible = rows.filter(({ member: m, view }) =>
    (filter === 'all' || view.key === filter) &&
    (!q || `${m.firstName} ${m.lastName} ${m.email} ${m.phone ?? ''}`.toLowerCase().includes(q)),
  )
  const selected = visible.find(r => r.member.id === selectedId) ?? visible[0] ?? null

  function openProfile(id: string) {
    const params = new URLSearchParams(paramsString)
    params.set('member', id)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  function select(id: string) {
    // Below lg the side panel is hidden: go straight to the full profile
    if (window.matchMedia('(max-width: 1023px)').matches) openProfile(id)
    else setSelectedId(id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {counts.all === 0
              ? t.empty
              : t.activeOf(counts.activo + counts.atencion, counts.all)}
            {counts.atencion + counts.vencido > 0 && ` · ${t.needAttention(counts.atencion + counts.vencido)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={newPaymentHref}
            scroll={false}
            className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700 hover:border-zinc-300 transition-colors"
          >
            <CreditCard className="h-4 w-4" />
            {t.registerPayment}
          </Link>
          <Link
            href={newMemberHref}
            scroll={false}
            className="flex h-11 items-center gap-2 rounded-xl bg-[#0e7a70] px-4 text-sm font-extrabold text-white hover:bg-[#095a52] transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t.newMember}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
          <Input
            type="search"
            aria-label={t.search}
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 h-11 rounded-xl"
            fieldType="search"
          />
        </div>
        <div role="tablist" aria-label={t.filter} className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(key => {
            const on = filter === key
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(key)}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-bold transition-colors',
                  on
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
                )}
              >
                {filterLabels[key]}
                <span className={cn(
                  'rounded-full px-1.5 py-px text-xs',
                  on ? 'bg-white/20 text-white dark:bg-black/10 dark:text-black' : 'bg-zinc-100 text-zinc-600',
                )}>
                  {counts[key]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <section aria-label={t.list} className="w-full flex-1 min-w-0 rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className={cn(ROW_GRID, 'hidden md:grid px-5 py-3 border-b border-zinc-100 text-xs font-bold uppercase tracking-wider text-zinc-500')}>
            <span>{t.colMember}</span><span>{t.colPlan}</span><span>{t.colRemaining}</span><span>{t.colLastVisit}</span><span>{t.colStatus}</span>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-4">
              <UserCircle2 className="h-10 w-10 text-zinc-300" />
              <p className="font-bold">{members.length === 0 ? t.noneYet : t.noMatch}</p>
              <p className="text-sm text-zinc-500">
                {members.length === 0 ? t.noneYetHint : t.noMatchHint}
              </p>
            </div>
          ) : (
            <ul className="p-1.5 space-y-0.5">
              {visible.map(({ member: m, view }) => {
                const on = selected?.member.id === m.id
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => select(m.id)}
                      aria-pressed={on}
                      className={cn(
                        ROW_GRID,
                        'w-full min-h-[60px] rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                        on ? 'border-[#1fad9d] bg-[#1fad9d]/5' : 'border-transparent hover:bg-zinc-50',
                      )}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span className={cn(
                          'h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-[13px] font-extrabold',
                          view.key === 'inactivo' || view.key === 'sinplan'
                            ? 'bg-zinc-100 text-zinc-600'
                            : 'bg-[#1fad9d]/15 text-[#0a6158] dark:text-[#5fd4c4]',
                        )}>
                          {initials(m.firstName, m.lastName)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-bold">{m.firstName} {m.lastName}</span>
                          <span className="block truncate text-[13px] text-zinc-500">{m.email}</span>
                        </span>
                      </span>
                      <span className="hidden md:block min-w-0">
                        <span className="block truncate text-sm font-semibold">{view.planName}</span>
                        <span className="block truncate text-xs text-zinc-500">{view.planKind}</span>
                      </span>
                      <span className="hidden md:flex flex-col gap-1.5">
                        <span className="text-[13px] font-semibold text-zinc-700">{view.remainingLabel}</span>
                        <span className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                          <span className={cn('block h-full rounded-full', view.barClass)} style={{ width: `${Math.round(view.pct * 100)}%` }} />
                        </span>
                      </span>
                      <span className="hidden md:block text-[13px] text-zinc-700">{view.lastVisit}</span>
                      <span className={cn('justify-self-start rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap', view.badgeClass)}>
                        {view.label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="px-5 py-3 border-t border-zinc-100 text-[13px] text-zinc-500">
            {t.showing(visible.length, members.length)}
          </div>
        </section>

        {selected && (
          <MemberPanel
            key={selected.member.id}
            gymSlug={gymSlug}
            member={selected.member}
            view={selected.view}
            onOpenProfile={() => openProfile(selected.member.id)}
            paramsString={paramsString}
          />
        )}
      </div>
    </div>
  )
}
