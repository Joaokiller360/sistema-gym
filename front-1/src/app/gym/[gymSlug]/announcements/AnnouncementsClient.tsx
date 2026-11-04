'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle, Cake, CalendarClock, Check, Clock, DoorClosed, FlaskConical, Hammer, Info, Lock, Megaphone, Palmtree, Send, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIntlLocale, useT } from '@/i18n/client'
import { announcementsMessages } from './messages'
import { cancelPurchaseAction, requestPackAction, sendAnnouncementAction, sendTestAction } from './actions'
import {
  ANNOUNCEMENT_TYPES,
  type Announcement, type AnnouncementQuota, type AnnouncementType, type GymMessagePacks, type MessagePack,
} from './types'

const inputClass = 'w-full rounded-xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50'

const TYPE_ICON: Record<AnnouncementType, typeof Megaphone> = {
  CLOSURE: DoorClosed,
  HOLIDAY: Palmtree,
  RENOVATION: Hammer,
  SCHEDULE: Clock,
  GENERAL: Megaphone,
}

const SUBJECT_MAX = 60
const BODY_MAX = 700

/** Same collapsing the server applies: WhatsApp template params can't contain line breaks */
function flatten(text: string) {
  return text.replace(/\s*[\r\n\t]+\s*/g, ' · ').replace(/ {2,}/g, ' ').trim()
}

interface Props {
  gymSlug: string
  gymName: string
  quota: AnnouncementQuota | null
  history: Announcement[]
  packs: GymMessagePacks
}

export function AnnouncementsClient({ gymSlug, gymName, quota, history, packs }: Props) {
  const t = useT(announcementsMessages)
  const intl = useIntlLocale()
  const [type, setType] = useState<AnnouncementType>('CLOSURE')
  const [subject, setSubject] = useState<string>(t.templates.CLOSURE.subject)
  const [body, setBody] = useState<string>(t.templates.CLOSURE.body)
  const [testTo, setTestTo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isTesting, startTest] = useTransition()

  const num = (n: number) => n.toLocaleString(intl)
  const fmtDate = (iso: string, withTime = false) =>
    new Date(iso).toLocaleString(intl, withTime
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'long' })

  const enabled = quota?.enabled ?? false
  const whatsappReady = quota?.whatsappReady ?? false
  const need = quota?.activeRecipients ?? 0
  const left = quota?.remaining ?? null // null = unlimited
  const after = left === null ? null : left - need
  const notEnough = left !== null && left < need
  const canSend = enabled && whatsappReady && need > 0 && !notEnough
  const autoOn = Number(!!quota?.birthdayMessagesEnabled) + Number(!!quota?.expiryRemindersEnabled)

  function pickType(next: AnnouncementType) {
    // Only overwrite fields the user hasn't edited away from the current template
    const prev = t.templates[type]
    if (subject === prev.subject) setSubject(t.templates[next].subject)
    if (body === prev.body) setBody(t.templates[next].body)
    setType(next)
    setTestTo(null)
  }

  function handleSend() {
    if (!subject.trim()) return toast.error(t.subjectRequired)
    if (!body.trim()) return toast.error(t.bodyRequired)
    if (!window.confirm(t.confirm(need))) return
    startTransition(async () => {
      const res = await sendAnnouncementAction(gymSlug, { type, subject, body })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t.sent)
      setSubject(t.templates[type].subject)
      setBody(t.templates[type].body)
      setTestTo(null)
    })
  }

  function handleTest() {
    if (!subject.trim()) return toast.error(t.subjectRequired)
    if (!body.trim()) return toast.error(t.bodyRequired)
    startTest(async () => {
      const res = await sendTestAction(gymSlug, { type, subject, body })
      if (res.error) {
        toast.error(res.error)
        return
      }
      setTestTo(res.to ?? '')
    })
  }

  // Quota bar: what's used out of what this month allows (plan + monthly packs + credits)
  const total = left === null ? null : (quota?.used ?? 0) + left
  const pct = total ? Math.min(100, Math.round(((quota?.used ?? 0) / total) * 100)) : 0
  const tone = notEnough ? 'bad' : after !== null && after < need ? 'warn' : 'ok'
  const note = notEnough
    ? t.noteOut(need, num(left ?? 0))
    : after === null
      ? null
      : after < need
        ? t.noteLow(need, num(left ?? 0), num(after))
        : t.noteOk(need, num(left ?? 0), num(after))
  const showPacks = packs.enabled && (packs.packs.length > 0 || packs.purchases.length > 0)

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground text-sm mt-0.5 max-w-2xl">{t.subtitle}</p>
        </div>
        <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Megaphone className="h-5 w-5 text-blue-500" />
        </div>
      </div>

      {quota && (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-card p-4">
            <dt className="text-xs font-medium text-muted-foreground">{t.statMessages}</dt>
            <dd className="mt-1.5 font-mono text-2xl font-bold">
              {num(quota.used)}
              {total !== null && <span className="text-base text-muted-foreground"> / {num(total)}</span>}
            </dd>
            {total !== null && (
              <dd className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', tone === 'bad' ? 'bg-red-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-primary')}
                  style={{ width: `${pct}%` }}
                />
              </dd>
            )}
            <dd className="mt-2 text-xs text-muted-foreground">
              {quota.limit === null
                ? t.statUnlimited
                : t.statBreakdown(num(quota.limit), quota.monthlyExtra, quota.credits)}
              {' · '}
              {t.resets(fmtDate(quota.resetsAt))}
            </dd>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <dt className="text-xs font-medium text-muted-foreground">{t.statPerAnnouncement}</dt>
            <dd className="mt-1.5 font-mono text-2xl font-bold">{num(need)}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">{t.statPerAnnouncementHint}</dd>
          </div>
          <div className={cn('rounded-2xl border p-4', quota.membersWithoutPhone > 0 ? 'border-amber-500/30 bg-amber-500/10 text-amber-700' : 'bg-card')}>
            <dt className={cn('text-xs font-medium', quota.membersWithoutPhone === 0 && 'text-muted-foreground')}>{t.statWithoutPhone}</dt>
            <dd className="mt-1.5 font-mono text-2xl font-bold">{num(quota.membersWithoutPhone)}</dd>
            <dd className={cn('mt-1 text-xs', quota.membersWithoutPhone === 0 && 'text-muted-foreground')}>{t.statWithoutPhoneHint}</dd>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700">
            <dt className="text-xs font-medium">{t.statAuto}</dt>
            <dd className="mt-1.5 font-mono text-2xl font-bold">{autoOn}</dd>
            <dd className="mt-1 text-xs">{t.statAutoHint}</dd>
          </div>
        </dl>
      )}

      {!enabled && (
        <section className="flex items-start gap-4 rounded-2xl border border-dashed p-5">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-muted flex items-center justify-center">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm">{t.disabledTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.disabledHint}</p>
          </div>
        </section>
      )}

      {enabled && (
        <div className="flex flex-wrap items-start gap-5">
          {/* Composer */}
          <section aria-labelledby="new-h" className="min-w-0 flex-[1.35_1_440px] rounded-2xl border bg-card p-4 sm:p-6 space-y-5">
            <h2 id="new-h" className="font-semibold">{t.newTitle}</h2>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t.type}</p>
              <div role="group" aria-label={t.type} className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
                {ANNOUNCEMENT_TYPES.map(k => {
                  const Icon = TYPE_ICON[k]
                  const on = type === k
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => pickType(k)}
                      disabled={isPending}
                      aria-pressed={on}
                      className={cn(
                        'flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-[border-color,transform] sm:min-h-40 sm:p-5',
                        on ? 'border-foreground bg-foreground text-background' : 'bg-card hover:-translate-y-0.5 hover:border-foreground',
                      )}
                    >
                      <span className={cn('flex size-11 items-center justify-center rounded-xl', on ? 'bg-accent text-accent-foreground' : 'bg-muted')}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-base font-black">{t.types[k]}</span>
                      <span className="hidden text-xs leading-relaxed opacity-80 sm:block">{t.typeHints[k]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="block">
              <span className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>{t.subject}</span>
                <span className="font-mono">{subject.length}/{SUBJECT_MAX}</span>
              </span>
              <input
                value={subject}
                onChange={e => { setSubject(e.target.value.slice(0, SUBJECT_MAX)); setTestTo(null) }}
                disabled={isPending}
                className={cn(inputClass, 'mt-1')}
              />
            </label>

            <label className="block">
              <span className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>{t.body}</span>
                <span className="font-mono">{body.length}/{BODY_MAX}</span>
              </span>
              <textarea
                value={body}
                onChange={e => { setBody(e.target.value.slice(0, BODY_MAX)); setTestTo(null) }}
                disabled={isPending}
                rows={6}
                className={cn(inputClass, 'mt-1 resize-y leading-relaxed')}
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">{t.linesNote}</span>
            </label>

            {note && need > 0 && (
              <div
                role={tone === 'bad' ? 'alert' : 'status'}
                className={cn(
                  'flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-xs leading-relaxed',
                  tone === 'bad' ? 'bg-red-500/10 text-red-700' : tone === 'warn' ? 'bg-amber-500/10 text-amber-700' : 'bg-muted text-foreground/80',
                )}
              >
                {tone === 'ok' ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>
                  <strong>{note[0]}</strong> {note[1]}
                  {tone === 'bad' && ` ${showPacks ? t.noteOutPacks : t.noteOutNoPacks}`}
                  {tone !== 'ok' && showPacks && (
                    <> <a href="#packs" className="font-semibold underline underline-offset-2">{t.seePacks}</a></>
                  )}
                </span>
              </div>
            )}
            {!whatsappReady && (
              <p className="flex items-center gap-2 text-xs font-medium text-red-600"><AlertTriangle className="h-3.5 w-3.5" />{t.whatsappOff}</p>
            )}
            {whatsappReady && need === 0 && (
              <p className="flex items-center gap-2 text-xs font-medium text-red-600"><AlertTriangle className="h-3.5 w-3.5" />{t.noRecipients}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">{t.recipients(need)}</p>
              <div className="flex flex-1 flex-wrap justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting || isPending || !whatsappReady || !quota?.ownerPhoneSet || left === 0}
                  title={quota?.ownerPhoneSet ? undefined : t.testNoPhone}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50 sm:flex-none"
                >
                  <FlaskConical className="h-4 w-4" />
                  {isTesting ? t.testing : t.test}
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isPending || !canSend}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:flex-none"
                >
                  <Send className="h-4 w-4" />
                  {isPending ? t.sending : t.send}
                </button>
              </div>
            </div>
            {quota && !quota.ownerPhoneSet && whatsappReady && (
              <p className="text-[11px] text-muted-foreground">{t.testNoPhone}</p>
            )}
            {testTo !== null && (
              <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-3 text-xs text-emerald-700">
                <Check className="h-4 w-4 shrink-0" />{t.testSent(testTo)}
              </p>
            )}
          </section>

          <div className="min-w-0 flex-[1_1_320px] space-y-5">
            {/* WhatsApp preview */}
            <section className="rounded-2xl border bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">{t.preview}</h2>
              <div className="mx-auto max-w-sm rounded-[28px] bg-black p-2.5">
                <div className="overflow-hidden rounded-[20px] bg-[#e7ddd3] dark:bg-[#0b141a]">
                  <div className="flex items-center gap-2.5 bg-[#0b5c54] px-3.5 py-3 text-white dark:bg-[#1f2c34]">
                    <span className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-black text-accent-foreground">
                      {gymName.slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <span className="block text-sm font-bold">{gymName}</span>
                      <span className="block text-[11px] opacity-80">{t.previewBusiness}</span>
                    </span>
                  </div>
                  <div className="min-h-64 px-3.5 pb-7 pt-4">
                    <div className="max-w-[92%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-sm leading-relaxed shadow-sm text-zinc-900 dark:bg-[#202c33] dark:text-zinc-100 whitespace-pre-wrap break-words">
                      {t.previewIntro(gymName)}
                      {'\n\n'}
                      <strong>{flatten(subject) || '…'}</strong>
                      {'\n'}
                      {flatten(body) || '…'}
                      {'\n\n'}
                      {t.previewOutro}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Automatic messages */}
            {quota && (
              <section className="rounded-2xl border bg-card p-5 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold">{t.autoTitle}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.autoHint}</p>
                </div>
                {([
                  [Cake, t.autoBirthday, quota.birthdayMessagesEnabled],
                  [CalendarClock, t.autoExpiry, quota.expiryRemindersEnabled],
                ] as const).map(([Icon, label, on]) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="flex-1 text-sm">{label}</p>
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
                      on ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600' : 'text-muted-foreground',
                    )}>
                      {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {on ? t.on : t.off}
                    </span>
                  </div>
                ))}
              </section>
            )}
          </div>
        </div>
      )}

      {showPacks && <PacksSection gymSlug={gymSlug} packs={packs} left={left} />}

      {/* History */}
      <section className="space-y-3">
        <h2 className="font-semibold">{t.historyTitle}</h2>
        {history.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">{t.historyEmpty}</p>
        ) : (
          history.map(a => {
            const Icon = TYPE_ICON[a.type] ?? Megaphone
            const done = a.sentCount + a.failedCount > 0
            const total = Math.max(1, a.recipientCount)
            return (
              <article key={a.id} className="rounded-2xl border bg-card overflow-hidden">
                <div className="flex flex-wrap items-start gap-3 px-5 py-4 border-b bg-muted/20">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 basis-48">
                    <h3 className="font-semibold text-sm truncate">{a.subject}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.types[a.type] ?? a.type} · {fmtDate(a.sentAt, true)} · {t.historyMessages(a.recipientCount)}
                    </p>
                  </div>
                  <div className="w-full text-xs sm:w-56">
                    {done ? (
                      <>
                        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                          <span className="bg-primary" style={{ width: `${(a.sentCount / total) * 100}%` }} />
                          <span className="bg-red-500" style={{ width: `${(a.failedCount / total) * 100}%` }} />
                        </div>
                        <p className="mt-1.5 flex justify-between font-mono">
                          <span className="text-muted-foreground">{t.delivered(a.sentCount, a.recipientCount)}</span>
                          {a.failedCount > 0 && <span className="text-red-600">{t.failed(a.failedCount)}</span>}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground sm:text-right">{t.pending}</p>
                    )}
                  </div>
                </div>
                <p className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{a.body}</p>
              </article>
            )
          })
        )}
      </section>
    </div>
  )
}

function PacksSection({ gymSlug, packs, left }: { gymSlug: string; packs: GymMessagePacks; left: number | null }) {
  const t = useT(announcementsMessages)
  const intl = useIntlLocale()
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const money = (v: number, currency: string, digits = 0) =>
    v.toLocaleString(intl, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits })
  const priceLabel = (p: { price: number; currency: string }) => money(p.price, p.currency, p.price % 1 ? 2 : 0)

  const open = new Map(packs.purchases.map(p => [p.packId, p]))

  function request(pack: MessagePack) {
    setBusyId(pack.id)
    startTransition(async () => {
      const res = await requestPackAction(gymSlug, pack.id)
      setBusyId(null)
      if (res.error) toast.error(res.error)
      else toast.success(t.requested)
    })
  }

  function cancel(id: string) {
    if (!window.confirm(t.cancelConfirm)) return
    setBusyId(id)
    startTransition(async () => {
      const res = await cancelPurchaseAction(gymSlug, id)
      setBusyId(null)
      if (res.error) toast.error(res.error)
    })
  }

  return (
    <section id="packs" aria-labelledby="packs-h" className="scroll-mt-6 rounded-2xl border bg-card p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="packs-h" className="font-semibold">{t.packsTitle}</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{t.packsHint}</p>
        </div>
        {left !== null && <p className="text-xs">{t.balance(left.toLocaleString(intl))}</p>}
      </div>

      {packs.purchases.length > 0 && (
        <div className="rounded-xl border">
          <p className="border-b px-4 py-2.5 text-xs font-semibold text-muted-foreground">{t.yourPacks}</p>
          <ul>
            {packs.purchases.map(p => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0">
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block text-sm font-semibold">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.messages.toLocaleString(intl)} {t.messagesUnit}{p.billing === 'MONTHLY' ? t.perMonth : ''} · {priceLabel(p)}{p.billing === 'MONTHLY' ? t.perMonth : ''}
                  </span>
                </span>
                <span className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  p.status === 'PENDING' ? 'bg-amber-500/10 text-amber-700' : 'bg-emerald-500/10 text-emerald-700',
                )}>
                  {p.status === 'PENDING' ? t.statusPending : t.statusActive}
                </span>
                <button
                  type="button"
                  onClick={() => cancel(p.id)}
                  disabled={isPending}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  {busyId === p.id ? '…' : t.cancel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {packs.packs.length === 0 ? (
        <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">{t.packsEmpty}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          {packs.packs.map(pack => {
            const monthly = pack.billing === 'MONTHLY'
            const taken = open.get(pack.id)
            return (
              <article key={pack.id} className="flex flex-col gap-3 rounded-2xl border p-5">
                <span className={cn(
                  'self-start rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  monthly ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted',
                )}>
                  {monthly ? t.monthly : t.once}
                </span>
                <h3 className="font-semibold">{pack.name}</h3>
                <p>
                  <span className="font-mono text-3xl font-bold">{pack.messages.toLocaleString(intl)}</span>
                  <span className="text-sm text-muted-foreground"> {t.messagesUnit}{monthly ? t.perMonth : ''}</span>
                </p>
                <p className="text-sm">
                  <strong>{priceLabel(pack)}</strong>
                  <span className="text-muted-foreground">
                    {monthly ? t.perMonth : ''} · {t.perMessage(money(pack.price / pack.messages, pack.currency, 3))}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{monthly ? t.monthlyNote : t.onceNote}</p>
                <button
                  type="button"
                  onClick={() => request(pack)}
                  disabled={isPending || !!taken}
                  className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-black text-accent-foreground hover:brightness-95 disabled:opacity-50"
                >
                  {busyId === pack.id
                    ? '…'
                    : taken
                      ? (taken.status === 'PENDING' ? t.statusPending : t.statusActive)
                      : monthly ? t.subscribe : t.request(priceLabel(pack))}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
