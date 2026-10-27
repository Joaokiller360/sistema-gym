import type { Member, MembershipStatus } from '@/types'
import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from '@/i18n/config'
import { memberStatusMessages } from './messages'

export type MemberRow = Member & {
  memberships?: Array<{
    status: MembershipStatus
    endDate: string
    visitsTotal: number | null
    visitsUsed: number
    plan: { id: string; name: string; durationDays: number; visitLimit: number | null }
  }>
  attendances?: Array<{ checkIn: string }>
}

export type StatusKey = 'activo' | 'atencion' | 'vencido' | 'sinplan' | 'inactivo'

// Keys stay Spanish: they're internal ids (and used in URLs); labels come from memberStatusMessages.filters
export const STATUS_FILTERS: (StatusKey | 'all')[] = ['all', 'activo', 'atencion', 'vencido', 'sinplan', 'inactivo']

// Classes covered by the dark-mode overrides in globals.css
const TONES = {
  ok: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  neutral: 'bg-zinc-100 text-zinc-600',
} as const

const BARS = { ok: 'bg-[#1fad9d]', warn: 'bg-amber-500', bad: 'bg-red-600', info: 'bg-blue-500', neutral: 'bg-zinc-300' } as const

export interface MemberView {
  key: StatusKey
  label: string
  badgeClass: string
  barClass: string
  planName: string
  planKind: string
  remainingLabel: string
  /** 0–1 share of the plan still left */
  pct: number
  bigNumber: string
  bigCaption: string
  planNote: string
  lastVisit: string
  lastVisitAt: string | null
}

const DAY = 86_400_000
/** Time plans with this many days or fewer, and visit plans with this many visits or fewer, need attention */
const SOON_DAYS = 3
const SOON_VISITS = 2

function fmtDay(iso: string, locale: Locale) {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale], { day: '2-digit', month: '2-digit' })
}

export function fmtLastVisit(iso: string | null, now = new Date(), locale: Locale = DEFAULT_LOCALE) {
  const t = memberStatusMessages[locale]
  if (!iso) return t.never
  const d = new Date(iso)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const time = d.toLocaleTimeString(INTL_LOCALE[locale], { hour: '2-digit', minute: '2-digit' })
  if (d.getTime() >= startOfToday) return t.today(time)
  const days = Math.ceil((startOfToday - d.getTime()) / DAY)
  if (days <= 1) return t.yesterday
  if (days < 30) return t.daysAgo(days)
  return t.monthsAgo(Math.round(days / 30))
}

export function memberView(m: MemberRow, now = new Date(), locale: Locale = DEFAULT_LOCALE): MemberView {
  const t = memberStatusMessages[locale]
  const lastVisitAt = m.attendances?.[0]?.checkIn ?? null
  const base = { lastVisit: fmtLastVisit(lastVisitAt, now, locale), lastVisitAt }
  const view = (key: StatusKey, label: string, tone: keyof typeof TONES, rest: Omit<MemberView, 'key' | 'label' | 'badgeClass' | 'barClass' | 'lastVisit' | 'lastVisitAt'>): MemberView =>
    ({ key, label, badgeClass: TONES[tone], barClass: BARS[tone], ...rest, ...base })

  const list = m.memberships ?? []
  // The membership that defines today's access: a current ACTIVE/FROZEN one, else the latest of any status
  const current = list.find(x => (x.status === 'ACTIVE' || x.status === 'FROZEN') && new Date(x.endDate) >= now) ?? list[0]

  if (!m.isActive) {
    return view('inactivo', t.inactive, 'neutral', {
      planName: current?.plan.name ?? t.noPlan, planKind: '—', remainingLabel: '—', pct: 0,
      bigNumber: '—', bigCaption: t.inactiveCaption, planNote: t.inactiveNote,
    })
  }
  if (!current) {
    return view('sinplan', t.noPlan, 'neutral', {
      planName: t.noPlan, planKind: '—', remainingLabel: '—', pct: 0,
      bigNumber: '—', bigCaption: t.noPlanCaption, planNote: t.noPlanNote,
    })
  }

  const end = fmtDay(current.endDate, locale)
  const daysLeft = Math.max(0, Math.ceil((new Date(current.endDate).getTime() - now.getTime()) / DAY))
  const isVisit = current.visitsTotal != null
  const planKind = isVisit ? t.visitKind(current.visitsTotal!, end) : t.timeKind(end)
  const ended = current.status === 'EXPIRED' || current.status === 'CANCELLED' || current.status === 'SUSPENDED' || daysLeft === 0

  if (ended) {
    const usedUp = isVisit && current.visitsUsed >= current.visitsTotal!
    const label = current.status === 'CANCELLED' ? t.cancelled : current.status === 'SUSPENDED' ? t.suspended : t.expired
    return view('vencido', label, 'bad', {
      planName: current.plan.name, planKind,
      remainingLabel: usedUp ? t.noDays : label, pct: 0,
      bigNumber: '0',
      bigCaption: usedUp ? t.ofTrainingDays(current.visitsTotal!) : t.daysToExpiry,
      planNote: usedUp
        ? t.usedUpNote
        : t.endedNote(end),
    })
  }

  if (current.status === 'FROZEN') {
    return view('activo', t.frozen, 'info', {
      planName: current.plan.name, planKind, remainingLabel: t.frozen, pct: 1,
      bigNumber: String(daysLeft), bigCaption: t.daysOnUnfreeze,
      planNote: t.frozenNote,
    })
  }

  if (isVisit) {
    const total = current.visitsTotal!
    const left = Math.max(0, total - current.visitsUsed)
    const soon = left <= SOON_VISITS || daysLeft <= SOON_DAYS
    return view(soon ? 'atencion' : 'activo', soon ? t.expiringSoon : t.active, soon ? 'warn' : 'ok', {
      planName: current.plan.name, planKind,
      remainingLabel: t.leftOf(left, total), pct: left / total,
      bigNumber: String(left), bigCaption: t.ofTrainingDaysLeft(total),
      planNote: t.visitNote(current.visitsUsed, end),
    })
  }

  const period = Math.max(1, current.plan.durationDays)
  const soon = daysLeft <= SOON_DAYS
  return view(soon ? 'atencion' : 'activo', soon ? t.expiringSoon : t.active, soon ? 'warn' : 'ok', {
    planName: current.plan.name, planKind,
    remainingLabel: t.days(daysLeft), pct: Math.min(1, daysLeft / period),
    bigNumber: String(daysLeft), bigCaption: daysLeft === 1 ? t.dayToExpiry : t.daysToExpiry,
    planNote: t.freeUntil(end),
  })
}
