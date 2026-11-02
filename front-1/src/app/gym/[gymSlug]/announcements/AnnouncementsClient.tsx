'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Cake, CalendarClock, Hammer, Lock, Megaphone, Palmtree, Send, Clock, DoorClosed, Check, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIntlLocale, useT } from '@/i18n/client'
import { announcementsMessages } from './messages'
import { sendAnnouncementAction } from './actions'
import { ANNOUNCEMENT_TYPES, type Announcement, type AnnouncementQuota, type AnnouncementType } from './types'

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
}

export function AnnouncementsClient({ gymSlug, gymName, quota, history }: Props) {
  const t = useT(announcementsMessages)
  const intl = useIntlLocale()
  const [type, setType] = useState<AnnouncementType>('CLOSURE')
  const [subject, setSubject] = useState<string>(t.templates.CLOSURE.subject)
  const [body, setBody] = useState<string>(t.templates.CLOSURE.body)
  const [isPending, startTransition] = useTransition()

  const enabled = quota?.enabled ?? false
  const limitReached = quota?.remaining === 0
  const whatsappReady = quota?.whatsappReady ?? false
  const canSend = enabled && whatsappReady && !limitReached && (quota?.activeRecipients ?? 0) > 0
  const fmtDate = (iso: string, withTime = false) =>
    new Date(iso).toLocaleString(intl, withTime
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'long' })

  function pickType(next: AnnouncementType) {
    // Only overwrite fields the user hasn't edited away from the current template
    const prev = t.templates[type]
    if (subject === prev.subject) setSubject(t.templates[next].subject)
    if (body === prev.body) setBody(t.templates[next].body)
    setType(next)
  }

  function handleSend() {
    if (!subject.trim()) return toast.error(t.subjectRequired)
    if (!body.trim()) return toast.error(t.bodyRequired)
    if (!window.confirm(t.confirm(quota?.activeRecipients ?? 0))) return
    startTransition(async () => {
      const res = await sendAnnouncementAction(gymSlug, { type, subject, body })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t.sent)
      setSubject(t.templates[type].subject)
      setBody(t.templates[type].body)
    })
  }

  const pct = quota && quota.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t.subtitle}</p>
        </div>
        <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Megaphone className="h-5 w-5 text-blue-500" />
        </div>
      </div>

      {/* Quota */}
      {quota && enabled && (
        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">{t.quotaLabel}</p>
            <p className="text-sm font-mono">
              {quota.limit === null ? t.quotaUnlimited(quota.used) : t.quotaUsed(quota.used, quota.limit)}
            </p>
          </div>
          {quota.limit !== null && (
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', limitReached ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary')}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t.resets(fmtDate(quota.resetsAt))}</p>
          {limitReached && <p className="text-xs font-medium text-red-600">{t.limitReached}</p>}
        </section>
      )}

      {/* Plan without announcements */}
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

      {/* Composer */}
      {enabled && (
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold">{t.newTitle}</h2>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t.type}</p>
            <div className="flex flex-wrap gap-2">
              {ANNOUNCEMENT_TYPES.map(k => {
                const Icon = TYPE_ICON[k]
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pickType(k)}
                    disabled={isPending}
                    aria-pressed={type === k}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                      type === k ? 'bg-foreground text-background border-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.types[k]}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">{t.subject}</span>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
              disabled={isPending || !canSend}
              className={cn(inputClass, 'mt-1')}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">{t.body}</span>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value.slice(0, BODY_MAX))}
              disabled={isPending || !canSend}
              rows={5}
              className={cn(inputClass, 'mt-1 resize-y leading-relaxed')}
            />
            <span className="mt-1 flex justify-between gap-3 text-[11px] text-muted-foreground">
              <span>{t.linesNote}</span>
              <span className="font-mono shrink-0">{body.length}/{BODY_MAX}</span>
            </span>
          </label>

          {/* WhatsApp preview */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t.preview}</p>
            <div className="rounded-2xl bg-[#e7ddd3] dark:bg-[#0b141a] p-3">
              <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white dark:bg-[#202c33] px-3 py-2 text-sm leading-relaxed shadow-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words">
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

          {!whatsappReady && (
            <p className="flex items-center gap-2 text-xs font-medium text-red-600"><AlertTriangle className="h-3.5 w-3.5" />{t.whatsappOff}</p>
          )}
          {whatsappReady && (quota?.activeRecipients ?? 0) === 0 && (
            <p className="flex items-center gap-2 text-xs font-medium text-red-600"><AlertTriangle className="h-3.5 w-3.5" />{t.noRecipients}</p>
          )}
          {(quota?.membersWithoutPhone ?? 0) > 0 && (
            <p className="flex items-start gap-2 text-xs text-amber-600"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t.withoutPhone(quota!.membersWithoutPhone)}</p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{t.recipients(quota?.activeRecipients ?? 0)}</p>
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending || !canSend}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {isPending ? t.sending : t.send}
            </button>
          </div>
        </section>
      )}

      {/* Automatic emails */}
      {quota && (
        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <div>
            <h2 className="font-semibold">{t.autoTitle}</h2>
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

      {/* History */}
      <section className="space-y-3">
        <h2 className="font-semibold">{t.historyTitle}</h2>
        {history.length === 0 ? (
          <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">{t.historyEmpty}</p>
        ) : (
          history.map(a => {
            const Icon = TYPE_ICON[a.type] ?? Megaphone
            const done = a.sentCount + a.failedCount > 0
            return (
              <article key={a.id} className="rounded-2xl border bg-card overflow-hidden">
                <div className="flex items-start gap-3 px-5 py-4 border-b bg-muted/20">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{a.subject}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.types[a.type] ?? a.type} · {fmtDate(a.sentAt, true)}
                    </p>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    {done ? (
                      <>
                        <p className="text-muted-foreground">{t.delivered(a.sentCount, a.recipientCount)}</p>
                        {a.failedCount > 0 && <p className="text-red-600">{t.failed(a.failedCount)}</p>}
                      </>
                    ) : (
                      <p className="text-muted-foreground">{t.pending}</p>
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
