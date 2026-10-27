'use client'

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, Check, CheckCheck, Clock, ExternalLink, Inbox, Loader2, MessageCircle, Search, Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, GymMark, Meter, Pill, btn, chip, field, initials, type Tone } from '@/components/admin/ui'
import {
  getConversationAction, listConversationsAction, markReadAction, replyAction, sendContactTemplateAction,
  updateConversationAction, type CrmList, type CrmMessage, type CrmStatus, type CrmThread,
} from './actions'

const POLL_MS = 10_000

type Filter = CrmStatus | 'ALL'

const STATUS: Record<CrmStatus, { label: string; filter: string; tone: Tone }> = {
  OPEN: { label: 'Por responder', filter: 'Por responder', tone: 'warn' },
  PENDING: { label: 'Esperando al gym', filter: 'Esperando', tone: 'info' },
  CLOSED: { label: 'Cerrada', filter: 'Cerradas', tone: 'neutral' },
}

const QUICK_REPLIES = [
  { label: 'Saludo', text: '¡Hola! Gracias por escribirnos. ¿En qué te podemos ayudar?' },
  { label: 'Lo reviso', text: 'Dale, lo reviso y te escribo en un rato.' },
  { label: 'Mejorar plan', text: 'Podemos pasarte a un plan con más socios hoy mismo. ¿Querés que te cuente las opciones?' },
  { label: 'Resuelto', text: 'Listo, ya quedó resuelto. Cualquier otra cosa escribinos por acá.' },
]

function fmtPhone(digits: string) {
  return `+${digits}`
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function displayName(c: { contactName: string | null; gym: { name: string } | null; phone: string }) {
  return c.gym?.name ?? c.contactName ?? fmtPhone(c.phone)
}

/** Time left in Meta's 24 h window, e.g. "18 h". */
function windowLeft(lastInboundAt: string | null) {
  if (!lastInboundAt) return null
  const ms = new Date(lastInboundAt).getTime() + 24 * 3600_000 - Date.now()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600_000)
  return h > 0 ? `${h} h` : `${Math.max(1, Math.floor(ms / 60_000))} min`
}

function useVisiblePoll(fn: () => void) {
  const ref = useRef(fn)
  useEffect(() => { ref.current = fn })
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') ref.current() }, POLL_MS)
    return () => clearInterval(id)
  }, [])
}

function Tick({ m }: { m: CrmMessage }) {
  if (m.direction === 'IN') return null
  if (m.status === 'failed') return <AlertTriangle className="size-3.5 text-adm-bad-fg" aria-label="No enviado" />
  if (m.status === 'read') return <CheckCheck className="size-3.5 text-[#53bdeb]" aria-label="Leído" />
  if (m.status === 'delivered') return <CheckCheck className="size-3.5" aria-label="Entregado" />
  return <Check className="size-3.5" aria-label="Enviado" />
}

function Bubble({ m }: { m: CrmMessage }) {
  const out = m.direction === 'OUT'
  return (
    <li className={cn('flex', out ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[min(520px,85%)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          out
            ? 'rounded-br-md bg-adm-ink text-adm-surface'
            : 'rounded-bl-md border border-adm-line bg-adm-surface text-adm-ink',
          m.status === 'failed' && 'border border-adm-bad-line bg-adm-bad-bg text-adm-bad-fg',
        )}
      >
        {m.type === 'template' && (
          <p className={cn('mb-1 text-[11px] font-bold uppercase tracking-[0.06em]', out ? 'opacity-60' : 'text-adm-muted')}>
            {m.sentById ? 'Plantilla' : 'Aviso automático'}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        <p className={cn('mt-1 flex items-center justify-end gap-1 font-admin-mono text-[11px]', out ? 'opacity-70' : 'text-adm-muted')}>
          {new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          <Tick m={m} />
        </p>
        {m.error && <p className="mt-1 text-xs font-semibold">{m.error}</p>}
      </div>
    </li>
  )
}

function Messages({ messages }: { messages: CrmMessage[] }) {
  const endRef = useRef<HTMLLIElement>(null)
  const last = messages.at(-1)?.id
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [last])

  if (messages.length === 0) {
    return <EmptyState icon={<MessageCircle className="size-8" />}>Todavía no hay mensajes en esta conversación.</EmptyState>
  }
  return (
    <ol className="flex flex-col gap-2 px-4 py-5" aria-label="Mensajes">
      {messages.map((m, i) => {
        const day = new Date(m.createdAt).toDateString()
        const sep = i === 0 || day !== new Date(messages[i - 1].createdAt).toDateString()
        return (
          <Fragment key={m.id}>
            {sep && (
              <li className="my-2 self-center rounded-full bg-adm-chip px-3 py-1 text-xs font-semibold capitalize text-adm-muted">
                {fmtDay(m.createdAt)}
              </li>
            )}
            <Bubble m={m} />
          </Fragment>
        )
      })}
      <li ref={endRef} aria-hidden="true" />
    </ol>
  )
}

function Composer({ thread, onSent }: { thread: CrmThread; onSent: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const left = windowLeft(thread.lastInboundAt)

  function send() {
    const body = text.trim()
    if (!body || isPending) return
    setError(null)
    startTransition(async () => {
      const res = await replyAction(thread.id, body)
      if (res.error) setError(res.error)
      else { setText(''); onSent() }
    })
  }

  function sendTemplate() {
    setError(null)
    startTransition(async () => {
      const res = await sendContactTemplateAction(thread.id)
      if (res.error) setError(res.error)
      else onSent()
    })
  }

  if (!thread.windowOpen) {
    return (
      <div className="flex flex-col gap-3 border-t border-adm-line bg-adm-subtle p-4">
        <p className="flex items-start gap-2 text-[13px] text-adm-muted">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {thread.lastInboundAt
            ? 'Pasaron más de 24 h desde su último mensaje. WhatsApp solo deja escribirle con una plantilla aprobada; cuando responda, se habilita el chat libre.'
            : 'El gym todavía no te escribió. Para iniciar la conversación WhatsApp exige una plantilla aprobada.'}
        </p>
        {error && <p role="alert" className={field.error}>{error}</p>}
        <button type="button" onClick={sendTemplate} disabled={isPending} className={cn(btn.dark, 'min-h-10 self-start')}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          Enviar plantilla de contacto
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-adm-line bg-adm-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK_REPLIES.map(q => (
          <button
            key={q.label}
            type="button"
            onClick={() => setText(q.text)}
            disabled={isPending}
            className="min-h-8 rounded-full border border-adm-line bg-adm-subtle px-3 text-xs font-semibold transition-colors hover:border-adm-ink disabled:opacity-40"
          >
            {q.label}
          </button>
        ))}
        {left && <span className="ml-auto font-admin-mono text-xs text-adm-muted">Chat libre por {left} más</span>}
      </div>
      <div className="flex items-end gap-2">
        <label htmlFor="crm-reply" className="sr-only">Respuesta</label>
        <textarea
          id="crm-reply"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() }
          }}
          rows={2}
          maxLength={4096}
          disabled={isPending}
          placeholder="Escribí una respuesta… (Enter envía, Shift+Enter nueva línea)"
          className={cn(field.textarea, 'min-h-12 flex-1 resize-none')}
        />
        <button type="button" onClick={send} disabled={isPending || !text.trim()} aria-label="Enviar" className={cn(btn.primary, 'size-12 shrink-0 px-0')}>
          {isPending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
        </button>
      </div>
      {error && <p role="alert" className={field.error}>{error}</p>}
    </div>
  )
}

function Details({ thread, onChanged }: { thread: CrmThread; onChanged: () => void }) {
  const [notes, setNotes] = useState(thread.notes ?? '')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const gym = thread.gym
  const max = gym?.plan?.maxMembers ?? null
  const usage = gym && max ? Math.round((gym.members / max) * 100) : null

  function saveNotes() {
    if (notes === (thread.notes ?? '')) return
    startTransition(async () => {
      const res = await updateConversationAction(thread.id, { notes })
      if (!res.error) { setSaved(true); onChanged() }
    })
  }

  return (
    <aside aria-label="Detalles" className="flex flex-col gap-4 p-4">
      {gym ? (
        <div className="flex flex-col gap-3 rounded-xl border border-adm-line-soft p-3.5">
          <div className="flex items-center gap-3">
            <GymMark name={gym.name} logoUrl={gym.logoUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate font-bold">{gym.name}</p>
              <p className="truncate font-admin-mono text-xs text-adm-muted">/{gym.slug}</p>
            </div>
          </div>
          {gym.owner && (
            <p className="text-[13px]">
              <span className="text-adm-muted">Dueño · </span>
              <span className="font-semibold">{gym.owner.name}</span>
              <br />
              <a href={`mailto:${gym.owner.email}`} className="text-adm-muted hover:underline">{gym.owner.email}</a>
            </p>
          )}
          <div>
            <p className="flex justify-between text-[13px]">
              <span className="text-adm-muted">Plan {gym.plan?.label ?? gym.subscriptionPlan}</span>
              <span className="font-admin-mono font-semibold">{gym.members}{max ? ` / ${max}` : ''} socios</span>
            </p>
            {usage !== null && <Meter value={usage} className="mt-2" />}
          </div>
          <Link href={`/admin/gyms/${gym.slug}`} className={cn(btn.line, 'self-start')}>
            <ExternalLink className="size-3.5" aria-hidden="true" /> Ver gimnasio
          </Link>
        </div>
      ) : (
        <p className="rounded-xl border border-adm-warn-line bg-adm-warn-bg px-3.5 py-3 text-[13px] text-adm-warn-fg">
          Este número no coincide con ningún gimnasio. Cargalo como WhatsApp del dueño en el gimnasio para vincularlo.
        </p>
      )}

      <div>
        <label htmlFor="crm-notes" className={field.label}>Notas internas</label>
        <textarea
          id="crm-notes"
          value={notes}
          onChange={e => { setNotes(e.target.value); setSaved(false) }}
          onBlur={saveNotes}
          maxLength={5000}
          rows={6}
          placeholder="Solo las ve el equipo. Se guardan al salir del campo."
          className={field.textarea}
        />
        <p className={field.hint} aria-live="polite">{isPending ? 'Guardando…' : saved ? 'Guardado' : ' '}</p>
      </div>
    </aside>
  )
}

export function CrmInbox({
  config,
  initialList,
  initialThread,
  loadError,
}: {
  config: { enabled: boolean; webhookSigned: boolean }
  initialList: CrmList
  initialThread: CrmThread | null
  loadError: string | null
}) {
  const [list, setList] = useState(initialList)
  const [filter, setFilter] = useState<Filter>(initialThread ? 'ALL' : 'OPEN')
  const [q, setQ] = useState('')
  const [thread, setThread] = useState<CrmThread | null>(initialThread)
  const [selectedId, setSelectedId] = useState<string | null>(initialThread?.id ?? null)
  const [error, setError] = useState<string | null>(loadError)
  const [loadingThread, startThread] = useTransition()
  const [isPending, startTransition] = useTransition()

  const reloadList = useCallback(async () => {
    const res = await listConversationsAction('ALL', q)
    if ('error' in res) setError(res.error)
    else { setError(null); setList(res) }
  }, [q])

  const reloadThread = useCallback(async (id: string) => {
    const res = await getConversationAction(id)
    if ('error' in res) return
    setThread(res)
    if (res.unreadCount > 0) await markReadAction(id)
  }, [])

  useVisiblePoll(() => {
    void reloadList()
    if (selectedId) void reloadThread(selectedId)
  })

  // Debounced search
  useEffect(() => {
    const id = setTimeout(() => { void reloadList() }, 300)
    return () => clearTimeout(id)
  }, [reloadList])

  useEffect(() => {
    if (initialThread?.unreadCount) void markReadAction(initialThread.id)
  }, [initialThread])

  function open(id: string) {
    setSelectedId(id)
    window.history.replaceState(null, '', `?c=${id}`)
    startThread(async () => { await reloadThread(id); await reloadList() })
  }

  function close() {
    setSelectedId(null)
    setThread(null)
    window.history.replaceState(null, '', '?')
  }

  function changeStatus(status: CrmStatus) {
    if (!thread) return
    setThread({ ...thread, status })
    startTransition(async () => {
      await updateConversationAction(thread.id, { status })
      await reloadList()
    })
  }

  const shown = list.data.filter(c => filter === 'ALL' || c.status === filter)
  const total = list.data.length
  const active = thread && thread.id === selectedId ? thread : null

  return (
    <div className="flex flex-col gap-4">
      {(!config.enabled || !config.webhookSigned) && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-adm-warn-line bg-adm-warn-bg px-4 py-3 text-[13px] text-adm-warn-fg">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {!config.enabled && 'No se pueden enviar mensajes: faltan WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en el back. '}
            {!config.webhookSigned && 'No se reciben mensajes: falta WHATSAPP_APP_SECRET y configurar el webhook en Meta. '}
            Ver back-1/docs/whatsapp-templates.md.
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Estado" className="flex flex-wrap gap-2">
          {(['OPEN', 'PENDING', 'CLOSED', 'ALL'] as const).map(f => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={chip(filter === f)}>
              {f === 'ALL' ? 'Todas' : STATUS[f].filter}
              <span className="font-admin-mono text-xs opacity-75">{f === 'ALL' ? total : list.counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="relative ml-auto min-w-0 flex-[0_1_280px]">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-adm-muted" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Gym, nombre o número"
            className={cn(field.input, 'pl-9')}
          />
        </label>
      </div>

      {error && <p role="alert" className={field.error}>{error}</p>}

      <div className="flex h-[calc(100dvh-260px)] min-h-[520px] overflow-hidden rounded-2xl border border-adm-line bg-adm-surface">
        {/* List: hidden on small screens while a thread is open */}
        <section
          aria-label="Conversaciones"
          className={cn('flex w-full min-w-0 flex-col border-adm-line md:w-[340px] md:shrink-0 md:border-r', selectedId && 'hidden md:flex')}
        >
          {shown.length === 0 ? (
            <EmptyState icon={<Inbox className="size-8" />}>
              {total === 0 ? 'Todavía no hay conversaciones. Aparecen cuando un dueño escribe o le llega un aviso.' : 'Nada en este filtro.'}
            </EmptyState>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {shown.map(c => {
                const on = c.id === selectedId
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => open(c.id)}
                      className={cn(
                        'flex w-full items-start gap-3 border-b border-adm-line-soft px-4 py-3.5 text-left transition-colors',
                        on ? 'bg-[#fffde0] shadow-[inset_3px_0_0_var(--adm-ink)] dark:bg-[#24230f]' : 'hover:bg-adm-subtle',
                      )}
                    >
                      {c.gym
                        ? <GymMark name={c.gym.name} logoUrl={c.gym.logoUrl} />
                        : <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-adm-chip text-xs font-extrabold">{initials(c.contactName ?? '#')}</span>}
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cn('truncate text-sm', c.unreadCount > 0 ? 'font-extrabold' : 'font-bold')}>{displayName(c)}</span>
                          <span className="shrink-0 font-admin-mono text-[11px] text-adm-muted">{fmtTime(c.lastMessageAt)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={cn('min-w-0 flex-1 truncate text-[13px]', c.unreadCount > 0 ? 'font-semibold text-adm-ink' : 'text-adm-muted')}>
                            {c.lastMessage ? `${c.lastMessage.direction === 'OUT' ? 'Vos: ' : ''}${c.lastMessage.body}` : '—'}
                          </span>
                          {c.unreadCount > 0 && (
                            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#1fad9d] px-1.5 text-[11px] font-extrabold text-white">
                              {c.unreadCount}
                            </span>
                          )}
                        </span>
                        {filter === 'ALL' && <span><Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill></span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Thread */}
        <section aria-label="Conversación" className={cn('min-w-0 flex-1 flex-col', selectedId ? 'flex' : 'hidden md:flex')}>
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState icon={<MessageCircle className="size-10" />}>Elegí una conversación para responder.</EmptyState>
            </div>
          ) : !active ? (
            <div className="flex flex-1 items-center justify-center text-adm-muted">
              <Loader2 className="size-6 animate-spin" aria-label="Cargando" />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex flex-wrap items-center gap-3 border-b border-adm-line px-4 py-3">
                  <button type="button" onClick={close} aria-label="Volver" className={cn(btn.icon, 'md:hidden')}>
                    <ArrowLeft className="size-4" aria-hidden="true" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-extrabold">{displayName(active)}</h2>
                    <p className="truncate font-admin-mono text-xs text-adm-muted">
                      {fmtPhone(active.phone)}{active.contactName && active.gym ? ` · ${active.contactName}` : ''}
                    </p>
                  </div>
                  <label className="flex items-center gap-2">
                    <span className="sr-only">Estado</span>
                    <select
                      value={active.status}
                      onChange={e => changeStatus(e.target.value as CrmStatus)}
                      disabled={isPending}
                      className="min-h-9 rounded-lg border border-adm-line bg-adm-surface px-2.5 text-[13px] font-semibold"
                    >
                      {(Object.keys(STATUS) as CrmStatus[]).map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
                    </select>
                  </label>
                  {active.gym && (
                    <Link href={`/admin/gyms/${active.gym.slug}`} className={cn(btn.line, 'xl:hidden')}>
                      {active.gym.members}{active.gym.plan?.maxMembers ? `/${active.gym.plan.maxMembers}` : ''} socios
                    </Link>
                  )}
                  <a
                    href={`https://wa.me/${active.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btn.line}
                    title="Abrir en WhatsApp"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                </header>
                <div className={cn('min-h-0 flex-1 overflow-y-auto bg-adm-subtle', loadingThread && 'opacity-70')}>
                  <Messages messages={active.messages} />
                </div>
                <Composer key={active.id} thread={active} onSent={() => { void reloadThread(active.id); void reloadList() }} />
              </div>
              <div className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-adm-line xl:block">
                <Details key={active.id} thread={active} onChanged={() => void reloadThread(active.id)} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
