'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarCheck, RotateCcw, UserRound, Wallet } from 'lucide-react'
import { MembershipWithRelations, Plan } from '@/types'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { fmtLong, type MembershipView } from './membershipView'
import {
  cancelMembershipAction,
  changePlanAction,
  freezeMembershipAction,
  getMembershipDetailAction,
  restoreVisitDayAction,
  suspendMembershipAction,
  unfreezeMembershipAction,
  type MembershipDetail,
  type MembershipVisitDay,
} from './actions'
import { useIntlLocale, useLocale, useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'
import { membershipsMessages } from './messages'


export function MembershipPanel({
  gymSlug,
  membership,
  view,
  plans,
  canManage,
  bare,
}: {
  gymSlug: string
  membership: MembershipWithRelations
  view: MembershipView
  plans: Plan[]
  canManage: boolean
  /** Rendered inside a dialog: no card chrome */
  bare?: boolean
}) {
  const router = useRouter()
  const [detail, setDetail] = useState<MembershipDetail | null>(null)
  const [reload, setReload] = useState(0)
  const [restoreTarget, setRestoreTarget] = useState<MembershipVisitDay | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [newPlanId, setNewPlanId] = useState('')
  const [isPending, startTransition] = useTransition()
  const t = useT(membershipsMessages).panel
  const tc = useT(commonMessages)
  const locale = useLocale()
  const intl = useIntlLocale()
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(intl, { weekday: 'short', day: 'numeric', month: 'short' })
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' })
  const fmtDate = (iso: string) => fmtLong(iso, locale)
  const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString(intl)}`

  const { member, plan, status } = membership
  const name = `${member.firstName} ${member.lastName}`

  useEffect(() => {
    let cancelled = false
    getMembershipDetailAction(gymSlug, membership.id, member.id, membership.startDate)
      .then(d => { if (!cancelled) setDetail(d) })
    return () => { cancelled = true }
  }, [gymSlug, membership.id, member.id, membership.startDate, reload])

  function run(action: () => Promise<{ error?: string } | void | null>, success: string) {
    startTransition(async () => {
      try {
        const res = await action()
        if (res && typeof res === 'object' && 'error' in res && res.error) { toast.error(res.error); return }
        toast.success(success)
        setConfirmCancel(false)
        setNewPlanId('')
        router.refresh()
      } catch {
        toast.error(t.unexpected)
      }
    })
  }

  function confirmRestore() {
    if (!restoreTarget) return
    const target = restoreTarget
    startTransition(async () => {
      const res = await restoreVisitDayAction(gymSlug, member.id, target)
      setRestoreTarget(null)
      if (res.error) { toast.error(res.error); return }
      toast.success(t.dayReturned(member.firstName))
      setReload(r => r + 1)
    })
  }

  const canAct = status === 'ACTIVE' || status === 'FROZEN' || status === 'SUSPENDED'
  const otherPlans = plans.filter(p => p.id !== plan.id && p.isActive)
  const visitsTotal = membership.visitsTotal
  const paidTotal = detail?.payments.reduce((s, p) => s + p.amount, 0) ?? 0
  const afterRestore = view.visitsLeft != null ? view.visitsLeft + 1 : null

  return (
    <aside
      aria-label={t.membershipOf(name)}
      className={cn('flex flex-col', !bare && 'overflow-hidden rounded-2xl border border-zinc-200 bg-white')}
    >
      {/* Identity */}
      <div className="flex items-start gap-3 border-b border-zinc-100 p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1fad9d]/15 text-sm font-extrabold text-[#0a6158] dark:text-[#5fd4c4]">
          {`${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold leading-tight">{name}</p>
          <p className="truncate text-[13px] text-zinc-500">{member.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <Link href={`/gym/${gymSlug}/members/${member.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0e7a70] hover:underline">
              <UserRound className="h-3.5 w-3.5" /> {t.viewProfile}
            </Link>
          </div>
        </div>
      </div>

      {/* Plan + remaining */}
      <div className="space-y-4 border-b border-zinc-100 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold">{plan.name}</p>
            <p className="text-[13px] text-zinc-500">{plan.currency} {Number(plan.price).toLocaleString(intl)}</p>
          </div>
          <p className={cn('shrink-0 text-right text-sm font-bold', view.expiring ? 'text-amber-700' : 'text-zinc-800')}>{view.remainingLabel}</p>
        </div>

        {visitsTotal != null && visitsTotal <= 31 ? (
          <div role="img" aria-label={t.usedOf(membership.visitsUsed, visitsTotal)} className="flex gap-1">
            {Array.from({ length: visitsTotal }, (_, i) => (
              <span key={i} className={cn('h-2.5 flex-1 rounded-full', i < membership.visitsUsed ? 'bg-zinc-300' : 'bg-[#1fad9d]')} />
            ))}
          </div>
        ) : (
          <span className="block h-2 overflow-hidden rounded-full bg-zinc-100">
            <span className={cn('block h-full rounded-full', view.barClass)} style={{ width: `${Math.round(view.pct * 100)}%` }} />
          </span>
        )}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">{t.start}</dt>
            <dd className="font-semibold">{fmtDate(membership.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{t.end}</dt>
            <dd className="font-semibold">{fmtDate(membership.endDate)}</dd>
          </div>
          {status === 'FROZEN' && membership.frozenAt && (
            <div className="col-span-2">
              <dt className="text-xs text-zinc-500">{t.frozenSince}</dt>
              <dd className="font-semibold text-blue-700">{fmtDate(membership.frozenAt)}</dd>
            </div>
          )}
          {(membership.group?.length ?? 0) > 0 && (
            <div className="col-span-2">
              <dt className="text-xs text-zinc-500">{t.sharedWith}</dt>
              <dd className="font-semibold">{membership.group!.map(g => `${g.member.firstName} ${g.member.lastName}`).join(', ')}</dd>
            </div>
          )}
        </dl>
        {membership.notes && <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">{membership.notes}</p>}
      </div>

      {/* Days used (visit plans) */}
      {view.byVisits && (
        <section className="space-y-3 border-b border-zinc-100 p-5">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-zinc-500" />
            <h3 className="text-sm font-extrabold">{t.daysUsed}</h3>
            <span className="ml-auto text-xs text-zinc-500">{t.ofTotal(membership.visitsUsed, visitsTotal)}</span>
          </div>
          {!detail ? (
            <div className="space-y-2" aria-hidden="true">
              {[0, 1].map(i => <div key={i} className="h-11 animate-pulse rounded-xl bg-zinc-100" />)}
            </div>
          ) : detail.visits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-center text-[13px] text-zinc-500">{t.noDaysUsed}</p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
              {detail.visits.map(v => (
                <li key={v.attendanceId} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold capitalize">{fmtDay(v.checkIn)}</span>
                    <span className="block text-xs text-zinc-500">
                      {t.entered(fmtTime(v.checkIn))}{v.extraIds.length > 0 && t.entriesThatDay(v.extraIds.length + 1)}
                    </span>
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setRestoreTarget(v)}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-[13px] font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> {t.returnDay}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && (detail?.visits.length ?? 0) > 0 && (
            <p className="text-xs text-zinc-500">{t.returnHint}</p>
          )}
        </section>
      )}

      {/* Payments (read-only) */}
      <section className="space-y-3 border-b border-zinc-100 p-5">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-extrabold">{t.payments}</h3>
          {detail && detail.payments.length > 0 && (
            <span className="ml-auto text-xs font-semibold text-zinc-700">{money(paidTotal, detail.payments[0].currency)}</span>
          )}
        </div>
        {!detail ? (
          <div className="h-11 animate-pulse rounded-xl bg-zinc-100" aria-hidden="true" />
        ) : detail.payments.length === 0 ? (
          <p className="text-[13px] text-zinc-500">{t.noPayments}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
            {detail.payments.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span>
                  <span className="block font-semibold">{fmtDate(p.createdAt)}</span>
                  <span className="block text-xs text-zinc-500">{tc.methods[p.method] ?? p.method}</span>
                </span>
                <span className="font-bold">{money(p.amount, p.currency)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-zinc-500">{t.paymentsHint}</p>
      </section>

      {/* Actions */}
      {canManage && canAct && (
        <section className="space-y-3 p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t.actions}</h3>

          {status === 'ACTIVE' && otherPlans.length > 0 && (
            <div className="flex gap-2">
              <label className="sr-only" htmlFor={`change-plan-${membership.id}`}>{t.changePlan}</label>
              <select
                id={`change-plan-${membership.id}`}
                value={newPlanId}
                onChange={e => setNewPlanId(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
              >
                <option value="">{t.changeTo}</option>
                {otherPlans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.currency} {Number(p.price).toLocaleString(intl)}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!newPlanId || isPending}
                onClick={() => run(() => changePlanAction(gymSlug, membership.id, newPlanId), t.planChanged)}
                className="h-10 shrink-0 rounded-lg bg-[#1fad9d] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#0e7a70] disabled:opacity-50"
              >
                {t.change}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {status === 'ACTIVE' && (
              <>
                <button type="button" disabled={isPending}
                  onClick={() => run(() => freezeMembershipAction(gymSlug, membership.id), t.frozen)}
                  className="h-10 min-w-[110px] flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[13px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                >
                  {t.freeze}
                </button>
                <button type="button" disabled={isPending}
                  onClick={() => run(() => suspendMembershipAction(gymSlug, membership.id), t.suspended)}
                  className="h-10 min-w-[110px] flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[13px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                >
                  {t.suspend}
                </button>
              </>
            )}
            {status === 'FROZEN' && (
              <button type="button" disabled={isPending}
                onClick={() => run(() => unfreezeMembershipAction(gymSlug, membership.id), t.unfrozen)}
                className="h-10 flex-1 rounded-lg border border-[#1fad9d]/30 bg-[#1fad9d]/10 px-3 text-[13px] font-semibold text-[#0e7a70] transition-colors hover:bg-[#1fad9d]/20 disabled:opacity-50"
              >
                {t.unfreeze}
              </button>
            )}
          </div>

          {!confirmCancel ? (
            <button type="button" disabled={isPending} onClick={() => setConfirmCancel(true)}
              className="h-10 w-full rounded-lg border border-red-200 bg-red-50 px-3 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              {t.cancel}
            </button>
          ) : (
            <div className="space-y-2.5 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700">{t.cancelConfirm(member.firstName)}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmCancel(false)}
                  className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  {t.noGoBack}
                </button>
                <button type="button" disabled={isPending}
                  onClick={() => run(() => cancelMembershipAction(gymSlug, membership.id), t.cancelled)}
                  className="h-9 flex-1 rounded-lg bg-red-600 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? '…' : t.yesCancel}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <AlertDialog open={!!restoreTarget} onOpenChange={open => { if (!open) setRestoreTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.returnTitle(member.firstName)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.returnBody(restoreTarget ? fmtDay(restoreTarget.checkIn) : '')}
              {restoreTarget && restoreTarget.extraIds.length > 0 && t.returnOthers(restoreTarget.extraIds.length)}
              {afterRestore != null && visitsTotal != null && t.returnLeft(afterRestore, visitsTotal)}.
              {' '}{t.returnPayment}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{tc.cancel}</AlertDialogCancel>
            <button
              type="button"
              onClick={confirmRestore}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl bg-[#1fad9d] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#0e7a70] disabled:opacity-50"
            >
              {isPending ? t.returning : t.returnDay}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
