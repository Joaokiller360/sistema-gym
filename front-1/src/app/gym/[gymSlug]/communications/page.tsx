import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Communication } from '@/types'
import { Mail } from 'lucide-react'
import { getIntlLocale, getT } from '@/i18n/server'
import { communicationsMessages } from './messages'

interface Props {
  params: Promise<{ gymSlug: string }>
}

function fmtDate(iso: string, intl: string) {
  return new Date(iso).toLocaleString(intl, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function senderName(c: Communication, fallback: string) {
  return c.sentBy?.name?.trim() || fallback
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default async function CommunicationsPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const [t, intl] = await Promise.all([getT(communicationsMessages), getIntlLocale()])

  const communications = await apiFetch<Communication[]>(`/communications`, token, {
    headers: { 'x-gym-slug': gymSlug },
    next: { tags: [`communications-${gymSlug}`] },
  }) ?? []

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {communications.length === 0
              ? t.none
              : t.count(communications.length)}
          </p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Mail className="h-5 w-5 text-blue-500" />
        </div>
      </div>

      {/* Empty */}
      {communications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-24 gap-4 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
            <Mail className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm">{t.emptyTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t.emptyHint}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {communications.map(c => {
            const name = senderName(c, t.supportTeam)
            return (
              <article key={c.id} className="rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* Card header */}
                <div className="flex items-start gap-4 px-5 py-4 border-b bg-muted/20">
                  {/* Avatar */}
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-black">
                    {initials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-snug truncate">{c.subject}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{name}</p>
                  </div>
                  <time className="text-xs text-muted-foreground shrink-0 mt-0.5 hidden sm:block">
                    {fmtDate(c.sentAt, intl)}
                  </time>
                </div>
                {/* Body */}
                <div className="px-5 py-4 space-y-3">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{c.body}</p>
                  <time className="block text-xs text-muted-foreground sm:hidden">{fmtDate(c.sentAt, intl)}</time>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
