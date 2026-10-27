'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CreditCard, LogIn, QrCode, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { checkInAction } from '../attendance/actions'
import { issueWalletPassAction, emailWalletPassAction } from './[id]/wallet-actions'
import { getMemberPanelAction, type MemberPanelData } from './actions'
import type { MemberRow, MemberView } from './memberStatus'
import { useIntlLocale, useT } from '@/i18n/client'
import { membersMessages } from './messages'

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** 4 Monday-first weeks ending this week; future days are flagged so they render empty. */
function buildHeatmap(checkIns: string[], intl: string, now = new Date()) {
  const attended = new Set(checkIns.map(c => dayKey(new Date(c))))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const mondayOffset = (today.getDay() + 6) % 7
  const start = new Date(today)
  start.setDate(today.getDate() - mondayOffset - 21)
  return Array.from({ length: 28 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return {
      key: dayKey(d),
      label: d.toLocaleDateString(intl, { weekday: 'long', day: 'numeric', month: 'long' }),
      attended: attended.has(dayKey(d)),
      isToday: d.getTime() === today.getTime(),
      future: d > today,
    }
  })
}

export function MemberPanel({
  gymSlug,
  member,
  view,
  onOpenProfile,
  paramsString,
}: {
  gymSlug: string
  member: MemberRow
  view: MemberView
  onOpenProfile: () => void
  paramsString: string
}) {
  const router = useRouter()
  const [data, setData] = useState<MemberPanelData | null>(null)
  const [isPending, startTransition] = useTransition()
  const t = useT(membersMessages).panel
  const intl = useIntlLocale()
  const name = `${member.firstName} ${member.lastName}`

  useEffect(() => {
    let cancelled = false
    getMemberPanelAction(gymSlug, member.id).then(d => { if (!cancelled) setData(d) })
    return () => { cancelled = true }
  }, [gymSlug, member.id])

  const heat = data ? buildHeatmap(data.checkIns, intl) : null
  const visits = heat?.filter(d => d.attended).length ?? 0
  const canCheckIn = view.key === 'activo' || view.key === 'atencion'

  function checkIn() {
    startTransition(async () => {
      const res = await checkInAction(gymSlug, member.id)
      if (res.error) { toast.error(res.error); return }
      toast.success(
        res.visitsRemaining == null
          ? t.checkedIn(name)
          : res.visitsRemaining === 0
            ? t.lastDay(name)
            : t.daysLeft(name, res.visitsRemaining),
      )
      setData(d => d && { ...d, checkIns: [new Date().toISOString(), ...d.checkIns] })
      router.refresh()
    })
  }

  function pay() {
    const params = new URLSearchParams(paramsString)
    params.set('new', 'payment')
    params.set('payFor', member.id)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  function wallet() {
    const pass = data?.wallet
    if (!pass) return
    startTransition(async () => {
      if (pass.issued) {
        const res = await emailWalletPassAction(gymSlug, member.id)
        if (res.error || !res.emailSent) toast.error(res.error ?? t.emailFailed)
        else toast.success(t.passResent(member.email))
        return
      }
      const res = await issueWalletPassAction(gymSlug, member.id, true)
      if (res.error) { toast.error(res.error); return }
      toast.success(res.emailSent ? t.passCreatedSent(member.email) : t.passCreated)
      setData(d => d && d.wallet ? { ...d, wallet: { ...d.wallet, issued: true } } : d)
    })
  }

  return (
    <aside aria-label={t.profileOf(name)} className="hidden lg:flex w-[400px] shrink-0 flex-col gap-3.5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-3.5">
          <span className="h-14 w-14 shrink-0 rounded-full bg-[#1fad9d]/15 flex items-center justify-center text-lg font-black text-[#0a6158] dark:text-[#5fd4c4]">
            {`${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold leading-tight truncate">{name}</h2>
            <p className="text-[13px] text-zinc-500">
              {t.memberSince(new Date(member.createdAt).toLocaleDateString(intl, { month: 'short', year: 'numeric' }))}
            </p>
          </div>
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap', view.badgeClass)}>{view.label}</span>
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <dt className="text-xs text-zinc-500">{t.email}</dt>
            <dd className="text-sm font-semibold truncate">{member.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{t.phone}</dt>
            <dd className="text-sm font-semibold">{member.phone || '—'}</dd>
          </div>
        </dl>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={checkIn}
            disabled={isPending || !canCheckIn}
            title={canCheckIn ? undefined : t.needsPlan}
            className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl bg-[#0e7a70] text-[13px] font-extrabold text-white hover:bg-[#095a52] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <LogIn className="h-[18px] w-[18px]" />
            {t.checkIn}
          </button>
          <button
            type="button"
            onClick={pay}
            className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white text-[13px] font-bold hover:border-zinc-300 transition-colors"
          >
            <CreditCard className="h-[18px] w-[18px]" />
            {t.charge}
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white text-[13px] font-bold hover:border-zinc-300 transition-colors"
          >
            <UserRound className="h-[18px] w-[18px]" />
            {t.openProfile}
          </button>
        </div>
      </section>

      <section aria-labelledby="panel-plan" className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="panel-plan" className="text-[15px] font-extrabold truncate">{view.planName}</h3>
          <span className="text-xs text-zinc-500 shrink-0">{view.planKind}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black tracking-tight text-[#0e7a70] dark:text-[#5fd4c4]">{view.bigNumber}</span>
          <span className="text-sm text-zinc-700">{view.bigCaption}</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-100 overflow-hidden" aria-hidden="true">
          <div className={cn('h-full rounded-full', view.barClass)} style={{ width: `${Math.round(view.pct * 100)}%` }} />
        </div>
        <p className="text-[13px] text-zinc-500">{view.planNote}</p>
      </section>

      <section aria-labelledby="panel-attendance" className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 id="panel-attendance" className="text-[15px] font-extrabold">{t.attendance4w}</h3>
          {heat && <span className="text-[13px] text-zinc-500"><strong className="text-foreground">{visits}</strong> {t.days(visits)}</span>}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {t.weekdayInitials.map((d, i) => (
            <span key={i} aria-hidden="true" className="text-center text-[11px] text-zinc-500">{d}</span>
          ))}
          {heat
            ? heat.map(d => (
                <span
                  key={d.key}
                  title={`${d.label}${d.attended ? t.trained : ''}`}
                  className={cn(
                    'aspect-square rounded',
                    d.future ? 'bg-transparent' : d.attended ? 'bg-[#1fad9d]' : 'bg-zinc-100',
                    d.isToday && 'ring-2 ring-inset ring-zinc-900 dark:ring-white',
                  )}
                />
              ))
            : Array.from({ length: 28 }, (_, i) => <span key={i} className="aspect-square rounded bg-zinc-100 animate-pulse" />)}
        </div>
      </section>

      {data?.wallet && (
        <section aria-labelledby="panel-wallet" className="rounded-2xl bg-zinc-950 text-zinc-50 p-5 flex items-center gap-3.5 dark:border dark:border-zinc-800">
          <QrCode className="h-7 w-7 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <h3 id="panel-wallet" className="text-[15px] font-extrabold">{t.wallet}</h3>
            <p className="text-[13px] text-zinc-300">
              {!data.wallet.configured
                ? t.walletNotConfigured
                : data.wallet.issued
                  ? t.walletIssued
                  : t.walletNone}
            </p>
          </div>
          {data.wallet.configured && (
            <button
              type="button"
              onClick={wallet}
              disabled={isPending}
              className="h-10 shrink-0 rounded-lg bg-[#fffb00] px-3.5 text-[13px] font-extrabold text-black hover:bg-yellow-300 disabled:opacity-50 transition-colors"
            >
              {data.wallet.issued ? t.resend : t.issue}
            </button>
          )}
        </section>
      )}
    </aside>
  )
}
