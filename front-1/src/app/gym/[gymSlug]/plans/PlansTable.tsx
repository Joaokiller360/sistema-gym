'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, Pencil, Star } from 'lucide-react'
import { Plan } from '@/types'
import { createPlanAction, togglePlanActiveAction } from './actions'
import { PAUSED_COLOR, PLAN_COLORS, accessLabel, durationLabel, money as moneyIn, peopleLabel, pricePerDay } from './planMath'
import { useLocale, useT } from '@/i18n/client'
import { plansMessages } from './messages'

interface Props {
  plans: Plan[]
  memberCounts: Record<string, number>
  gymSlug: string
}

type Filter = 'all' | 'time' | 'visits' | 'paused'
type Sort = 'members' | 'price' | 'name'

const FILTERS: Filter[] = ['all', 'time', 'visits', 'paused']

export function PlansTable({ plans, memberCounts, gymSlug }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('members')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const t = useT(plansMessages).table
  const locale = useLocale()
  const money = (value: number, currency: string, decimals = 0) => moneyIn(value, currency, decimals, locale)

  const colorOf = new Map(plans.map((p, i) => [p.id, p.isActive ? PLAN_COLORS[i % PLAN_COLORS.length] : PAUSED_COLOR]))
  const count = (p: Plan) => memberCounts[p.id] ?? 0
  const maxMembers = Math.max(0, ...plans.map(count))

  const visible = plans
    .filter(p =>
      filter === 'all' ? true
      : filter === 'paused' ? !p.isActive
      : filter === 'visits' ? p.visitLimit != null
      : p.visitLimit == null,
    )
    .sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1
      if (sort === 'price') return a.price - b.price
      if (sort === 'name') return a.name.localeCompare(b.name)
      return count(b) - count(a)
    })

  const activePlans = plans.filter(p => p.isActive)
  const perDay = activePlans.map(p => ({ plan: p, value: pricePerDay(p) })).sort((a, b) => a.value - b.value)
  const maxPerDay = Math.max(0, ...perDay.map(d => d.value))
  const paused = plans.filter(p => !p.isActive)

  function toggle(plan: Plan) {
    setBusyId(plan.id)
    startTransition(async () => {
      await togglePlanActiveAction(gymSlug, plan.id, !plan.isActive)
      setBusyId(null)
      router.refresh()
    })
  }

  function duplicate(plan: Plan) {
    setBusyId(plan.id)
    startTransition(async () => {
      const res = await createPlanAction(gymSlug, {
        name: `${plan.name} ${t.copySuffix}`.slice(0, 100),
        price: plan.price,
        currency: plan.currency,
        durationDays: plan.durationDays,
        daysPerWeek: plan.daysPerWeek == null ? 'unlimited' : String(plan.daysPerWeek),
        visitLimit: plan.visitLimit == null ? 'unlimited' : String(plan.visitLimit),
        maxMembers: plan.maxMembers,
        benefits: plan.benefits.map(value => ({ value })),
        isActive: false,
        isFeatured: false,
        storeEnabled: plan.storeEnabled,
      })
      setBusyId(null)
      if (res.error) toast.error(res.error)
      else { toast.success(t.duplicated); router.refresh() }
    })
  }

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section aria-label={t.plans} className="min-w-0 flex-[999_1_720px] overflow-hidden rounded-[18px] border border-adm-line bg-adm-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-adm-line px-4 py-3.5">
          <div role="tablist" aria-label={t.filter} className="flex flex-wrap gap-1 rounded-xl border border-adm-line bg-adm-ground p-1">
            {FILTERS.map(f => {
              const on = filter === f
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setFilter(f)}
                  className={`h-9 rounded-[9px] border px-3 text-[13px] font-bold transition-colors ${
                    on ? 'border-adm-ink bg-adm-subtle text-adm-ink' : 'border-transparent text-adm-muted hover:text-adm-ink'
                  }`}
                >
                  {t.filters[f]}
                </button>
              )
            })}
          </div>
          <label className="inline-flex items-center gap-2 text-[13px] text-adm-muted">
            {t.sort}
            <select
              value={sort}
              onChange={e => setSort(e.target.value as Sort)}
              className="h-10 rounded-[10px] border border-adm-line bg-adm-ground px-2.5 text-[13px] font-bold text-adm-ink"
            >
              <option value="members">{t.sortMembers}</option>
              <option value="price">{t.sortPrice}</option>
              <option value="name">{t.sortName}</option>
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.08em] text-adm-muted">
                <th scope="col" className="px-4 py-3 font-bold">{t.colPlan}</th>
                <th scope="col" className="px-2 py-3 text-right font-bold">{t.colPrice}</th>
                <th scope="col" className="px-2 py-3 font-bold">{t.colDuration}</th>
                <th scope="col" className="px-2 py-3 font-bold">{t.colAccess}</th>
                <th scope="col" className="w-[170px] px-2 py-3 font-bold">{t.colMembers}</th>
                <th scope="col" className="px-2 py-3 font-bold">{t.colActive}</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">{t.colActions}</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr className="border-t border-adm-line">
                  <td colSpan={7} className="px-4 py-12 text-center text-adm-muted">{t.emptyFilter}</td>
                </tr>
              )}
              {visible.map(p => {
                const color = colorOf.get(p.id) ?? PAUSED_COLOR
                const n = count(p)
                const benefits = p.benefits.length
                return (
                  <tr
                    key={p.id}
                    className={`border-t border-adm-line ${p.isFeatured ? 'bg-adm-subtle' : ''} ${p.isActive ? '' : 'text-adm-muted'} ${busyId === p.id ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="inline-flex items-center gap-2 text-[15px] font-extrabold">
                            <span className="truncate">{p.name}</span>
                            {p.isFeatured && <Star className="h-3.5 w-3.5 shrink-0 fill-adm-brand text-adm-brand" role="img" aria-label={t.featured} />}
                          </span>
                          <span className="text-xs text-adm-muted">
                            {benefits ? t.benefits(benefits) : t.noBenefits}
                            {p.storeEnabled && t.store}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3.5 text-right">
                      <span className="block font-admin-mono text-base font-bold">{money(p.price, p.currency)}</span>
                      <span className="font-admin-mono text-[11px] text-adm-muted">
                        {p.maxMembers > 1 ? t.each(money(p.price / p.maxMembers, p.currency)) : t.perDay(money(pricePerDay(p), p.currency, 2))}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3.5">{durationLabel(p.durationDays, locale)}</td>
                    <td className="px-2 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        <span className={`inline-flex h-[26px] items-center rounded-full px-2.5 text-xs font-extrabold ${
                          p.visitLimit != null ? 'bg-adm-warn-bg text-adm-warn-fg' : 'bg-adm-chip text-adm-ink'
                        }`}>
                          {accessLabel(p, locale)}
                        </span>
                        {p.maxMembers > 1 && (
                          <span className="inline-flex h-[26px] items-center rounded-full bg-adm-info-bg px-2.5 text-xs font-extrabold text-adm-info-fg">
                            {peopleLabel(p.maxMembers, locale)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 text-right font-admin-mono text-sm font-bold">{n}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-adm-line">
                          <span className="block h-full rounded-full" style={{ width: `${maxMembers ? (n / maxMembers) * 100 : 0}%`, background: color }} />
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={p.isActive}
                        aria-label={t.activeToggle(p.name)}
                        disabled={busyId === p.id}
                        onClick={() => toggle(p)}
                        className={`flex h-[26px] w-[46px] rounded-full p-[3px] transition-colors ${
                          p.isActive ? 'justify-end bg-adm-brand' : 'justify-start bg-adm-line'
                        }`}
                      >
                        <span className="h-5 w-5 rounded-full bg-adm-night" />
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right">
                      <Link
                        href={`?edit=${p.id}`}
                        aria-label={t.edit(p.name)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-adm-line text-adm-ink transition-colors hover:bg-adm-chip"
                      >
                        <Pencil className="h-[15px] w-[15px]" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        aria-label={t.duplicate(p.name)}
                        disabled={busyId === p.id}
                        onClick={() => duplicate(p)}
                        className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-adm-muted transition-colors hover:bg-adm-chip hover:text-adm-ink"
                      >
                        <Copy className="h-[15px] w-[15px]" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
        {perDay.length > 0 && (
          <section aria-labelledby="cmp-h" className="flex flex-col gap-3.5 rounded-[18px] border border-adm-line bg-adm-surface p-[18px]">
            <div className="flex flex-col gap-1">
              <h2 id="cmp-h" className="text-[15px] font-extrabold">{t.costPerDay}</h2>
              <p className="text-[13px] text-adm-muted">{t.costPerDayHint}</p>
            </div>
            <ul className="flex flex-col gap-3">
              {perDay.map(({ plan, value }, i) => (
                <li key={plan.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="truncate font-bold">{plan.name}</span>
                    <span className="font-admin-mono text-adm-muted">{money(value, plan.currency, 2)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-adm-line">
                    <div
                      className={`h-full rounded-full ${i === 0 ? 'bg-adm-brand' : 'bg-adm-muted/60'}`}
                      style={{ width: `${maxPerDay ? (value / maxPerDay) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {paused.map(p => (
          <section key={p.id} className="flex flex-col gap-2 rounded-[18px] border border-dashed border-adm-line p-[18px]">
            <h2 className="text-[15px] font-extrabold">{t.paused(p.name)}</h2>
            <p className="text-[13px] text-adm-muted">{t.pausedHint}</p>
            <button
              type="button"
              disabled={busyId === p.id}
              onClick={() => toggle(p)}
              className="h-10 self-start rounded-[10px] border border-adm-ink px-3.5 text-[13px] font-bold transition-colors hover:bg-adm-chip disabled:opacity-50"
            >
              {t.reactivate}
            </button>
          </section>
        ))}
      </aside>
    </div>
  )
}
