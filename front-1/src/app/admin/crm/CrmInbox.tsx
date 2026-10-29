'use client'

import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowLeft, Check, CheckCheck, Clock, ExternalLink, FileText, Inbox, Loader2, MessageCircle, Paperclip, Pencil, Plus, Search, Send, Trash2, Download, UserPen, X, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, GymMark, Meter, Switch, btn, chip, field, initials } from '@/components/admin/ui'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { NewChatDialog } from './NewChatDialog'
import { QuickRepliesDialog } from './QuickRepliesDialog'
import { TemplatePicker } from './TemplatePicker'
import {
  deleteConversationAction, deleteMessageAction, editMessageAction, getConversationAction, listConversationsAction, markReadAction, replyAction, sendContactTemplateAction,
  sendNowAction, updateConversationAction, type CrmList, type CrmMessage, type CrmStatus, type CrmThread, type QuickReply,
} from './actions'

const POLL_MS = 10_000

/** ACTIVE = still needs something from either side (OPEN + PENDING) */
type Filter = 'ACTIVE' | 'CLOSED' | 'ALL'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ACTIVE', label: 'Activas' },
  { key: 'CLOSED', label: 'Cerradas' },
  { key: 'ALL', label: 'Todas' },
]

const STATUS: Record<CrmStatus, { label: string; short: string }> = {
  OPEN: { label: 'Por responder', short: 'Por responder' },
  PENDING: { label: 'Esperando al gym', short: 'Esperando' },
  CLOSED: { label: 'Cerrada', short: 'Cerrada' },
}

/** Meta's customer service window */
const WINDOW_MS = 24 * 3600_000
/** Unanswered chats whose window closes sooner than this go to the top */
const HOT_MS = 4 * 3600_000

type Group = 'URGENT' | CrmStatus

const GROUPS: { key: Group; title: string }[] = [
  { key: 'URGENT', title: 'Se cierra el chat libre' },
  { key: 'OPEN', title: 'Por responder' },
  { key: 'PENDING', title: 'Esperando al gym' },
  { key: 'CLOSED', title: 'Cerradas' },
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

function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

const noop = () => () => {}
// The server formats in its own time zone and ICU build (e.g. "a. m." with a narrow space), so
// dates only render once hydrated, in the viewer's time zone
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false)

function LocalTime({ iso, format }: { iso: string; format: (iso: string) => string }) {
  return useHydrated() ? format(iso) : null
}

function displayName(c: { alias: string | null; contactName: string | null; gym: { name: string } | null; phone: string }) {
  // A linked gym already identifies the number; the alias is only for unknown ones
  return c.gym?.name || c.alias || c.contactName || fmtPhone(c.phone)
}

/** Secondary line under the name: whatever displayName didn't already show. */
function subtitle(c: { alias: string | null; contactName: string | null; gym: { name: string } | null; phone: string }) {
  const name = displayName(c)
  return [fmtPhone(c.phone), c.gym ? null : c.alias, c.contactName].filter((v, i, all) => v && v !== name && all.indexOf(v) === i).join(' · ')
}

function TagChip({ children, onRemove }: { children: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-adm-line bg-adm-chip px-2 py-0.5 text-[11px] font-semibold leading-4 text-adm-ink">
      <span className="truncate">{children}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Quitar etiqueta ${children}`} className="-mr-0.5 rounded-full text-adm-muted hover:text-adm-ink">
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}

const MAX_TAGS = 10

/** Name + tags for any number, gym or not. Saves on blur / on each tag change. */
function ContactEditor({ thread, allTags, onChanged }: { thread: CrmThread; allTags: string[]; onChanged: () => void }) {
  const [alias, setAlias] = useState(thread.alias ?? '')
  const [tags, setTags] = useState(thread.tags)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const listId = `crm-tags-${thread.id}`

  function save(data: { alias?: string; tags?: string[] }) {
    setStatus(null)
    startTransition(async () => {
      const res = await updateConversationAction(thread.id, data)
      setStatus(res.error ?? 'Guardado')
      if (!res.error) onChanged()
    })
  }

  function saveAlias() {
    if (alias.trim() === (thread.alias ?? '')) return
    save({ alias: alias.trim() })
  }

  function addTag(raw: string) {
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, 30)
    setDraft('')
    if (!tag || tags.length >= MAX_TAGS || tags.some(t => t.toLowerCase() === tag.toLowerCase())) return
    const next = [...tags, tag]
    setTags(next)
    save({ tags: next })
  }

  function removeTag(tag: string) {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    save({ tags: next })
  }

  const suggestions = allTags.filter(t => !tags.some(x => x.toLowerCase() === t.toLowerCase()))

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-adm-line-soft p-3.5">
      {!thread.gym && (
      <div>
        <label htmlFor={`crm-alias-${thread.id}`} className={field.label}>Nombre del contacto</label>
        <input
          id={`crm-alias-${thread.id}`}
          value={alias}
          onChange={e => setAlias(e.target.value)}
          onBlur={saveAlias}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          maxLength={80}
          placeholder={thread.contactName ?? 'Ej. Juan · interesado en plan Pro'}
          className={field.input}
        />
      </div>
      )}
      <div>
        <label htmlFor={`crm-tag-${thread.id}`} className={field.label}>Etiquetas</label>
        {tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tags.map(t => <TagChip key={t} onRemove={() => removeTag(t)}>{t}</TagChip>)}
          </div>
        )}
        <input
          id={`crm-tag-${thread.id}`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(draft) }
            if (e.key === 'Backspace' && !draft && tags.length) removeTag(tags[tags.length - 1])
          }}
          onBlur={() => { if (draft.trim()) addTag(draft) }}
          list={listId}
          maxLength={30}
          disabled={tags.length >= MAX_TAGS}
          placeholder={tags.length >= MAX_TAGS ? 'Máximo 10 etiquetas' : 'Escribí y apretá Enter'}
          className={field.input}
        />
        <datalist id={listId}>
          {suggestions.map(t => <option key={t} value={t} />)}
        </datalist>
      </div>
      <p className={field.hint} aria-live="polite">{isPending ? 'Guardando…' : status ?? ' '}</p>
    </div>
  )
}

/** Ms left in Meta's 24 h window; 0 once closed. */
function windowMs(lastInboundAt: string | null) {
  if (!lastInboundAt) return 0
  return Math.max(0, new Date(lastInboundAt).getTime() + WINDOW_MS - Date.now())
}

/** e.g. "18 h", "1 h 20 min", "12 min" */
function fmtLeft(ms: number) {
  const h = Math.floor(ms / 3600_000)
  const min = Math.floor((ms % 3600_000) / 60_000)
  if (h >= 4) return `${h} h`
  if (h > 0) return min ? `${h} h ${min} min` : `${h} h`
  return `${Math.max(1, min)} min`
}

/** What's left of the window as a shrinking bar; orange in the last HOT_MS. */
function Fuse({ ms, className }: { ms: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('block h-1 flex-1 overflow-hidden rounded-full bg-adm-line-soft', className)}>
      <span
        className={cn('block h-full rounded-full', ms < HOT_MS ? 'bg-adm-high-fg' : 'bg-adm-ink')}
        style={{ width: `${Math.max(2, (ms / WINDOW_MS) * 100)}%` }}
      />
    </span>
  )
}

function groupOf(c: { status: CrmStatus; lastInboundAt: string | null }): Group {
  const ms = c.status === 'OPEN' ? windowMs(c.lastInboundAt) : 0
  return ms > 0 && ms < HOT_MS ? 'URGENT' : c.status
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
  if (m.status === 'queued') return <Clock className="size-3.5" aria-label="En cola" />
  if (m.status === 'sending') return <Loader2 className="size-3.5 animate-spin" aria-label="Enviando" />
  return <Check className="size-3.5" aria-label="Enviado" />
}

/** Mirrors the back's UNDO_MS: replies wait this long before going out */
const UNDO_MS = 60_000

/** Countdown + edit/delete while a reply is still queued. */
function QueuedReply({ m, conversationId, onChanged }: { m: CrmMessage; conversationId: string; onChanged: () => void }) {
  const sendAt = new Date(m.createdAt).getTime() + UNDO_MS
  const [now, setNow] = useState(() => Date.now())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(m.body)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const left = Math.max(0, Math.ceil((sendAt - now) / 1000))

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // The back flushes every 5 s: check back right after it should have gone out
  useEffect(() => {
    if (left > 0) return
    const id = setTimeout(onChanged, 6000)
    return () => clearTimeout(id)
  }, [left, onChanged])

  function save() {
    const body = draft.trim()
    if (!body) return
    setError(null)
    startTransition(async () => {
      const res = await editMessageAction(conversationId, m.id, body)
      if (res.error) setError(res.error)
      else setEditing(false)
      onChanged()
    })
  }

  function sendNow() {
    setError(null)
    startTransition(async () => {
      const res = await sendNowAction(conversationId, m.id)
      if (res.error) setError(res.error)
      onChanged()
    })
  }

  function remove() {
    setError(null)
    startTransition(async () => {
      const res = await deleteMessageAction(conversationId, m.id)
      if (res.error) setError(res.error)
      onChanged()
    })
  }

  if (left === 0) return <p className="mt-1.5 text-xs opacity-70">Enviando…</p>

  return (
    <div className="mt-2 border-t border-adm-surface/20 pt-2">
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
              if (e.key === 'Escape') { setEditing(false); setDraft(m.body) }
            }}
            maxLength={4096}
            rows={3}
            autoFocus
            aria-label="Editar mensaje"
            className="w-full resize-y rounded-lg bg-adm-surface px-2.5 py-2 text-sm text-adm-ink outline-none"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setDraft(m.body) }} disabled={isPending} className="rounded-md px-2 py-1 text-xs font-semibold opacity-80 hover:opacity-100">
              Cancelar
            </button>
            <button type="button" onClick={save} disabled={isPending || !draft.trim()} className="rounded-md bg-adm-brand px-2.5 py-1 text-xs font-bold text-adm-night disabled:opacity-50">
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-xs">
          <span className="font-admin-mono opacity-70" aria-live="off">Se envía en 0:{String(left).padStart(2, '0')}</span>
          <span className="flex-1" />
          <button type="button" onClick={sendNow} disabled={isPending} className="inline-flex items-center gap-1 font-semibold opacity-80 hover:opacity-100">
            <Zap className="size-3" aria-hidden="true" /> Enviar ya
          </button>
          <button type="button" onClick={() => setEditing(true)} disabled={isPending} className="inline-flex items-center gap-1 font-semibold opacity-80 hover:opacity-100">
            <Pencil className="size-3" aria-hidden="true" /> Editar
          </button>
          <button type="button" onClick={remove} disabled={isPending} className="inline-flex items-center gap-1 font-semibold opacity-80 hover:opacity-100">
            <Trash2 className="size-3" aria-hidden="true" /> Eliminar
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs font-semibold">{error}</p>}
    </div>
  )
}

// Bodies the back stores when a media message has no caption: hidden once the media itself shows
const MEDIA_ONLY = new Set(['📷 Imagen', '🎥 Video', '🎤 Audio', '📄 Documento', 'Sticker'])

function ImagePreview({ src }: { src: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block cursor-zoom-in" aria-label="Ver imagen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Imagen recibida" className="max-h-72 rounded-lg object-cover" loading="lazy" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogOverlay className="bg-black/85 supports-backdrop-filter:backdrop-blur-sm" />
          <DialogPrimitive.Popup
            // Clicking the dark area around the photo closes it, like the backdrop
            onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none sm:p-10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <DialogTitle className="sr-only">Imagen recibida</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Imagen recibida" className="max-h-[75vh] max-w-[min(90vw,720px)] rounded-lg object-contain shadow-2xl" />
            <div className="absolute top-3 right-3 flex gap-2">
              <a
                href={src}
                download
                className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Descargar"
                title="Descargar"
              >
                <Download className="size-4.5" aria-hidden="true" />
              </a>
              <DialogClose
                className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Cerrar"
              >
                <X className="size-5" aria-hidden="true" />
              </DialogClose>
            </div>
          </DialogPrimitive.Popup>
        </DialogPortal>
      </Dialog>
    </>
  )
}

function Media({ m }: { m: CrmMessage }) {
  const src = m.mediaUrl!
  switch (m.type) {
    case 'sticker':
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt="Sticker" className="size-32 object-contain" loading="lazy" />
    case 'image':
      return <ImagePreview src={src} />
    case 'video':
      return <video src={src} controls preload="metadata" className="max-h-72 rounded-lg" />
    case 'audio':
      return <audio src={src} controls preload="metadata" className="max-w-full" />
    default:
      return (
        <a href={src} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
          📄 Abrir archivo
        </a>
      )
  }
}

function Bubble({ m, conversationId, onChanged }: { m: CrmMessage; conversationId: string; onChanged: () => void }) {
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
          m.status === 'queued' && 'outline-2 outline-offset-2 outline-dashed outline-adm-brand',
        )}
      >
        {m.type === 'template' && (
          <p className={cn('mb-1 text-[11px] font-bold uppercase tracking-[0.06em]', out ? 'opacity-60' : 'text-adm-muted')}>
            {m.sentById ? 'Plantilla' : 'Aviso automático'}
          </p>
        )}
        {m.mediaUrl && <Media m={m} />}
        {!(m.mediaUrl && MEDIA_ONLY.has(m.body.replace(/ \(abrilo en WhatsApp\)$/, ''))) && (
          <p className={cn('whitespace-pre-wrap break-words', m.mediaUrl && 'mt-1.5')}>{m.body}</p>
        )}
        <p className={cn('mt-1 flex items-center justify-end gap-1 font-admin-mono text-[11px]', out ? 'opacity-70' : 'text-adm-muted')}>
          <LocalTime iso={m.createdAt} format={fmtClock} />
          <Tick m={m} />
        </p>
        {m.error && <p className="mt-1 text-xs font-semibold">{m.error}</p>}
        {m.status === 'queued' && <QueuedReply key={m.body} m={m} conversationId={conversationId} onChanged={onChanged} />}
      </div>
    </li>
  )
}

function Messages({ messages, conversationId, onChanged }: { messages: CrmMessage[]; conversationId: string; onChanged: () => void }) {
  const endRef = useRef<HTMLLIElement>(null)
  const last = messages.at(-1)?.id
  const hydrated = useHydrated()
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
            {sep && hydrated && (
              <li className="my-2 self-center rounded-full bg-adm-chip px-3 py-1 text-xs font-semibold capitalize text-adm-muted">
                {fmtDay(m.createdAt)}
              </li>
            )}
            <Bubble m={m} conversationId={conversationId} onChanged={onChanged} />
          </Fragment>
        )
      })}
      <li ref={endRef} aria-hidden="true" />
    </ol>
  )
}

/** WhatsApp's caps; the back re-checks the real type from the bytes */
const MEDIA_LIMITS: Record<string, { kind: 'image' | 'video'; max: number }> = {
  'image/jpeg': { kind: 'image', max: 5 * 1024 * 1024 },
  'image/png': { kind: 'image', max: 5 * 1024 * 1024 },
  'video/mp4': { kind: 'video', max: 16 * 1024 * 1024 },
}

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Composer({
  thread,
  quickReplies,
  onManageQuickReplies,
  onSent,
}: {
  thread: CrmThread
  quickReplies: QuickReply[]
  onManageQuickReplies: () => void
  onSent: () => void
}) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<{ file: File; preview: string } | null>(null)
  const file = attachment?.file ?? null
  const [instant, setInstant] = useState(thread.instantSend)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // Frees the preview when it's removed, replaced or the thread closes
  useEffect(() => {
    if (!attachment) return
    const url = attachment.preview
    return () => URL.revokeObjectURL(url)
  }, [attachment])

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const limit = MEDIA_LIMITS[f.type]
    if (!limit) { setError('Solo fotos JPG/PNG o videos MP4'); return }
    if (f.size > limit.max) { setError(`WhatsApp acepta hasta ${limit.max / 1024 / 1024} MB para ${limit.kind === 'image' ? 'fotos' : 'videos'}`); return }
    setError(null)
    setAttachment({ file: f, preview: URL.createObjectURL(f) })
  }

  function send() {
    const body = text.trim()
    if ((!body && !file) || isPending) return
    setError(null)
    startTransition(async () => {
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        if (body) fd.append('caption', body)
        const res = await fetch(`/api/v1/admin/crm/conversations/${thread.id}/media`, { method: 'POST', body: fd })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) { setError(data.error ?? 'No se pudo enviar el archivo'); return }
        setAttachment(null)
      } else {
        const res = await replyAction(thread.id, body)
        if (res.error) { setError(res.error); return }
      }
      setText('')
      onSent()
    })
  }

  function toggleInstant(next: boolean) {
    setInstant(next)
    startTransition(async () => {
      const res = await updateConversationAction(thread.id, { instantSend: next })
      if (res.error) { setInstant(!next); setError(res.error) }
    })
  }

  function sendTemplate(kind: 'contact' | 'offer') {
    setError(null)
    startTransition(async () => {
      const res = await sendContactTemplateAction(thread.id, kind)
      if (res.error) setError(res.error)
      else onSent()
    })
  }

  const picker = (
    <TemplatePicker conversationId={thread.id} gymName={thread.gym?.name ?? null} open={templatesOpen} onOpenChange={setTemplatesOpen} onSent={onSent} />
  )

  if (!thread.windowOpen) {
    return (
      <div className="flex flex-col gap-3 border-t border-adm-line bg-adm-subtle p-4">
        <p className="flex items-start gap-2 text-[13px] text-adm-muted">
          <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {thread.lastInboundAt
            ? 'Pasaron más de 24 h desde su último mensaje. WhatsApp solo deja escribirle con una plantilla aprobada; cuando responda, se habilita el chat libre.'
            : 'Todavía no te escribió. Para iniciar la conversación WhatsApp exige una plantilla aprobada.'}
        </p>
        {error && <p role="alert" className={field.error}>{error}</p>}
        <div className="flex flex-wrap gap-2">
          {/* Prospects get the sales pitch first; linked gyms the plain contact one */}
          {(thread.gym ? (['contact', 'offer'] as const) : (['offer', 'contact'] as const)).map((kind, i) => (
            <button
              key={kind}
              type="button"
              onClick={() => sendTemplate(kind)}
              disabled={isPending}
              className={cn(i === 0 ? btn.dark : btn.line, 'min-h-10')}
            >
              {isPending && i === 0 ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              {kind === 'offer' ? 'Ofrecer servicios' : 'Plantilla de contacto'}
            </button>
          ))}
          <button type="button" onClick={() => setTemplatesOpen(true)} disabled={isPending} className={cn(btn.line, 'min-h-10')}>
            <FileText className="size-4" aria-hidden="true" /> Otra plantilla
          </button>
        </div>
        {picker}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-adm-line bg-adm-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {quickReplies.map(q => (
          <button
            key={q.id}
            type="button"
            onClick={() => setText(q.text)}
            disabled={isPending}
            title={q.text}
            className="min-h-8 rounded-full border border-adm-line bg-adm-subtle px-3 text-xs font-semibold transition-colors hover:border-adm-ink disabled:opacity-40"
          >
            {q.label}
          </button>
        ))}
        <button type="button" onClick={onManageQuickReplies} aria-label="Editar respuestas rápidas" title="Editar respuestas rápidas" className={cn(btn.icon, 'size-8')}>
          {quickReplies.length ? <Pencil className="size-3.5" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-adm-muted" title="Sin el minuto para editar o borrar la respuesta">
          <Zap className={cn('size-3.5', instant && 'text-adm-ink')} aria-hidden="true" />
          <span className={cn(instant && 'text-adm-ink')}>Enviar al instante</span>
          <Switch checked={instant} onChange={toggleInstant} disabled={isPending} label="Enviar al instante a este contacto" />
        </label>
      </div>
      {attachment && (
        <div className="flex items-center gap-3 rounded-xl border border-adm-line bg-adm-subtle p-2">
          {attachment.file.type.startsWith('image/')
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={attachment.preview} alt="" className="size-14 rounded-lg object-cover" />
            : <video src={attachment.preview} muted className="size-14 rounded-lg bg-adm-night object-cover" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{attachment.file.name}</p>
            <p className="font-admin-mono text-xs text-adm-muted">{fmtSize(attachment.file.size)} · se envía al instante</p>
          </div>
          <button type="button" onClick={() => setAttachment(null)} disabled={isPending} aria-label="Quitar archivo" className={btn.icon}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex shrink-0 flex-col gap-1">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={isPending} aria-label="Adjuntar foto o video" title="Foto (JPG/PNG, 5 MB) o video (MP4, 16 MB)" className={cn(btn.icon, 'size-10')}>
            <Paperclip className="size-4.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setTemplatesOpen(true)} disabled={isPending} aria-label="Enviar plantilla" title="Enviar plantilla" className={cn(btn.icon, 'size-10')}>
            <FileText className="size-4.5" aria-hidden="true" />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,video/mp4" onChange={pickFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
        <label htmlFor="crm-reply" className="sr-only">{file ? 'Texto del archivo' : 'Respuesta'}</label>
        <textarea
          id="crm-reply"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() }
          }}
          rows={2}
          maxLength={file ? 1024 : 4096}
          disabled={isPending}
          placeholder={file ? 'Agregá un texto (opcional)…' : 'Escribí una respuesta… (Enter envía, Shift+Enter nueva línea)'}
          className={cn(field.textarea, 'min-h-[84px] flex-1 resize-none')}
        />
        <button type="button" onClick={send} disabled={isPending || (!text.trim() && !file)} aria-label="Enviar" className={cn(btn.primary, 'size-12 shrink-0 px-0')}>
          {isPending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
        </button>
      </div>
      {error && <p role="alert" className={field.error}>{error}</p>}
      {picker}
    </div>
  )
}

function Details({ thread, allTags, onChanged }: { thread: CrmThread; allTags: string[]; onChanged: () => void }) {
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
            {usage !== null && <Meter value={usage} className={cn('mt-2', usage >= 90 && '[&>div]:bg-adm-high-fg')} />}
          </div>
          <Link href={`/admin/gyms/${gym.slug}`} className={cn(btn.line, 'self-start')}>
            <ExternalLink className="size-3.5" aria-hidden="true" /> Ver gimnasio
          </Link>
        </div>
      ) : (
        <p className="rounded-xl border border-adm-warn-line bg-adm-warn-bg px-3.5 py-3 text-[13px] text-adm-warn-fg">
          Este número no coincide con ningún gimnasio. Ponele un nombre abajo para identificarlo, o cargalo como WhatsApp del dueño en el gimnasio para vincularlo.
        </p>
      )}
      <ContactEditor thread={thread} allTags={allTags} onChanged={onChanged} />

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
  initialQuickReplies,
  loadError,
}: {
  config: { enabled: boolean; webhookSigned: boolean }
  initialList: CrmList
  initialThread: CrmThread | null
  initialQuickReplies: QuickReply[]
  loadError: string | null
}) {
  const [list, setList] = useState(initialList)
  const [quickReplies, setQuickReplies] = useState(initialQuickReplies)
  const [manageReplies, setManageReplies] = useState(false)
  const [filter, setFilter] = useState<Filter>(initialThread?.status === 'CLOSED' ? 'ALL' : 'ACTIVE')
  const [q, setQ] = useState('')
  const [thread, setThread] = useState<CrmThread | null>(initialThread)
  const [selectedId, setSelectedId] = useState<string | null>(initialThread?.id ?? null)
  const [error, setError] = useState<string | null>(loadError)
  const [loadingThread, startThread] = useTransition()
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

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

  const reloadActive = useCallback(() => {
    if (!selectedId) return
    void reloadThread(selectedId)
    void reloadList()
  }, [selectedId, reloadThread, reloadList])

  function changeStatus(status: CrmStatus) {
    if (!thread) return
    setThread({ ...thread, status })
    startTransition(async () => {
      await updateConversationAction(thread.id, { status })
      await reloadList()
    })
  }

  function deleteThread() {
    if (!thread) return
    const id = thread.id
    setDeleteError(null)
    startTransition(async () => {
      const res = await deleteConversationAction(id)
      if (res.error) { setDeleteError(res.error); return }
      setConfirmDelete(false)
      setList(l => ({ ...l, data: l.data.filter(c => c.id !== id) }))
      close()
      await reloadList()
    })
  }

  // Most used first; built from the loaded list so it needs no extra request
  const tagCounts = new Map<string, number>()
  for (const c of list.data) for (const t of c.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  const allTags = [...tagCounts.keys()].sort((a, b) => tagCounts.get(b)! - tagCounts.get(a)! || a.localeCompare(b))

  const shown = list.data.filter(c =>
    (filter === 'ALL' || (filter === 'CLOSED') === (c.status === 'CLOSED')) && (!tag || c.tags?.includes(tag)),
  )
  const total = list.data.length
  const counts: Record<Filter, number> = {
    ACTIVE: (list.counts.OPEN ?? 0) + (list.counts.PENDING ?? 0),
    CLOSED: list.counts.CLOSED ?? 0,
    ALL: total,
  }
  // Server order (latest first) within each group; the urgent one by time left
  const groups = GROUPS
    .map(g => ({ ...g, rows: shown.filter(c => groupOf(c) === g.key) }))
    .filter(g => g.rows.length > 0)
  groups.find(g => g.key === 'URGENT')?.rows.sort((a, b) => windowMs(a.lastInboundAt) - windowMs(b.lastInboundAt))
  const active = thread && thread.id === selectedId ? thread : null
  const activeLeft = active?.windowOpen ? windowMs(active.lastInboundAt) : 0

  return (
    <div className="flex flex-col gap-4">
      {(!config.enabled || !config.webhookSigned) && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-adm-warn-line bg-adm-warn-bg px-4 py-3 text-[13px] text-adm-warn-fg">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {!config.enabled && 'No se pueden enviar mensajes: faltan ZERNIO_API_KEY y ZERNIO_WHATSAPP_ACCOUNT_ID en el back. '}
            {!config.webhookSigned && 'No se reciben mensajes: falta ZERNIO_WEBHOOK_SECRET y configurar el webhook en Zernio. '}
            Ver back-1/docs/whatsapp-templates.md.
          </span>
        </p>
      )}

      {error && <p role="alert" className={field.error}>{error}</p>}

      <div className="flex h-[calc(100dvh-260px)] min-h-[520px] overflow-hidden rounded-2xl border border-adm-line bg-adm-surface">
        {/* List: hidden on small screens while a thread is open */}
        <section
          aria-label="Conversaciones"
          className={cn('flex w-full min-w-0 flex-col border-adm-line md:w-90 md:shrink-0 md:border-r', selectedId && 'hidden md:flex')}
        >
          <div className="flex flex-col gap-2.5 border-b border-adm-line-soft p-3.5">
            <div className="flex items-center gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Buscar</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-adm-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Gym, nombre o número"
                  className={cn(field.input, 'min-h-10 bg-adm-subtle pl-9')}
                />
              </label>
              <NewChatDialog onCreated={id => { setFilter('ALL'); open(id); void reloadList() }} />
            </div>
            <div role="group" aria-label="Filtros" className="flex flex-wrap gap-1.5">
              {FILTERS.map(f => (
                <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} className={cn(chip(filter === f.key), 'min-h-8 gap-1.5 px-3 text-xs font-bold')}>
                  {f.label}
                  <span className="font-admin-mono opacity-75">{counts[f.key]}</span>
                </button>
              ))}
              {allTags.map(t => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tag === t}
                  onClick={() => setTag(tag === t ? null : t)}
                  className={cn(chip(tag === t), 'min-h-8 gap-1.5 px-3 text-xs', tag !== t && 'border-dashed text-adm-muted')}
                >
                  {t}
                  <span className="font-admin-mono opacity-75">{tagCounts.get(t)}</span>
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={<Inbox className="size-8" />}>
              {total === 0 ? 'Todavía no hay conversaciones. Aparecen cuando un dueño escribe o le llega un aviso.' : 'Nada en este filtro.'}
            </EmptyState>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {groups.map(g => (
                <section key={g.key} aria-labelledby={`crm-group-${g.key}`}>
                  <h3 id={`crm-group-${g.key}`} className={cn('flex justify-between px-4 pt-3.5 pb-1.5 text-[11px] font-extrabold uppercase tracking-[0.06em]', g.key === 'URGENT' ? 'text-adm-high-fg' : 'text-adm-muted')}>
                    {g.title}
                    <span className="font-admin-mono">{g.rows.length}</span>
                  </h3>
                  <ul>
                    {g.rows.map(c => {
                      const on = c.id === selectedId
                      const left = c.status === 'OPEN' ? windowMs(c.lastInboundAt) : 0
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
                              : <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-adm-chip text-xs font-extrabold">{initials(c.alias || c.contactName || '#')}</span>}
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="flex items-baseline justify-between gap-2">
                                <span className={cn('truncate text-sm', c.unreadCount > 0 ? 'font-extrabold' : 'font-bold')}>{displayName(c)}</span>
                                <span className="shrink-0 font-admin-mono text-[11px] text-adm-muted"><LocalTime iso={c.lastMessageAt} format={fmtTime} /></span>
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
                              {left > 0 && (
                                <span className="mt-0.5 flex items-center gap-2" title="Tiempo para responder sin plantilla">
                                  <Fuse ms={left} />
                                  <span className={cn('font-admin-mono text-[11px] font-semibold', left < HOT_MS ? 'text-adm-high-fg' : 'text-adm-muted')}>
                                    {fmtLeft(left)}
                                  </span>
                                </span>
                              )}
                              {c.tags?.length > 0 && (
                                <span className="flex flex-wrap gap-1">
                                  {c.tags.slice(0, 3).map(t => <TagChip key={t}>{t}</TagChip>)}
                                  {c.tags?.length > 3 && <span className="text-[11px] font-semibold text-adm-muted">+{c.tags.length - 3}</span>}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
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
                    <p className="truncate font-admin-mono text-xs text-adm-muted">{subtitle(active)}</p>
                  </div>
                  <div role="group" aria-label="Estado" className="flex gap-0.5 rounded-[10px] bg-adm-chip p-0.5">
                    {(Object.keys(STATUS) as CrmStatus[]).map(s => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={active.status === s}
                        onClick={() => { if (active.status !== s) changeStatus(s) }}
                        disabled={isPending}
                        title={STATUS[s].label}
                        className={cn(
                          'min-h-8 rounded-lg px-3 text-[13px] transition-colors disabled:opacity-60',
                          active.status === s ? 'bg-adm-ink font-bold text-adm-surface' : 'font-semibold text-adm-muted hover:text-adm-ink',
                        )}
                      >
                        {STATUS[s].short}
                      </button>
                    ))}
                  </div>
                  {active.gym && (
                    <Link href={`/admin/gyms/${active.gym.slug}`} className={cn(btn.line, 'xl:hidden')}>
                      {active.gym.members}{active.gym.plan?.maxMembers ? `/${active.gym.plan.maxMembers}` : ''} socios
                    </Link>
                  )}
                  <button type="button" onClick={() => setDetailsOpen(true)} className={cn(btn.line, 'xl:hidden')}>
                    <UserPen className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Contacto</span>
                  </button>
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
                  <button
                    type="button"
                    onClick={() => { setDeleteError(null); setConfirmDelete(true) }}
                    disabled={isPending}
                    aria-label="Eliminar chat"
                    title="Eliminar chat"
                    className={cn(btn.icon, 'hover:bg-adm-bad-bg hover:text-adm-bad-fg')}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </header>
                {activeLeft > 0 && (
                  <div
                    className={cn(
                      'flex items-center gap-3 border-b px-4 py-2.5 text-[13px]',
                      activeLeft < HOT_MS ? 'border-adm-warn-line bg-adm-warn-bg text-adm-warn-fg' : 'border-adm-line-soft text-adm-muted',
                    )}
                  >
                    <Clock className="size-4 shrink-0" aria-hidden="true" />
                    <p className="shrink-0 font-bold">
                      Chat libre por <span className="font-admin-mono">{fmtLeft(activeLeft)}</span>
                    </p>
                    <Fuse ms={activeLeft} className="h-1.5" />
                    <p className="hidden shrink-0 text-xs sm:block">Después, solo con plantilla</p>
                  </div>
                )}
                <div className={cn('min-h-0 flex-1 overflow-y-auto bg-adm-subtle', loadingThread && 'opacity-70')}>
                  <Messages messages={active.messages} conversationId={active.id} onChanged={reloadActive} />
                </div>
                <Composer
                  key={active.id}
                  thread={active}
                  quickReplies={quickReplies}
                  onManageQuickReplies={() => setManageReplies(true)}
                  onSent={() => { void reloadThread(active.id); void reloadList() }}
                />
              </div>
              <div className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-adm-line xl:block">
                <Details key={active.id} thread={active} allTags={allTags} onChanged={reloadActive} />
              </div>
            </div>
          )}
        </section>
      </div>
      {/* Below xl the details column is hidden: same panel in a drawer */}
      <Sheet open={detailsOpen && !!active} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="admin-surface w-full gap-0 overflow-y-auto border-adm-line bg-adm-surface p-0 text-adm-ink data-[side=right]:w-full data-[side=right]:sm:max-w-[380px]">
          <SheetTitle className="px-4 pt-4 text-base font-extrabold">{active ? displayName(active) : 'Contacto'}</SheetTitle>
          {active && <Details key={active.id} thread={active} allTags={allTags} onChanged={reloadActive} />}
        </SheetContent>
      </Sheet>

      <QuickRepliesDialog open={manageReplies} onOpenChange={setManageReplies} replies={quickReplies} onChange={setQuickReplies} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent size="sm" className="admin-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran todos los mensajes, adjuntos y notas de {active ? displayName(active) : 'esta conversación'}. No se puede deshacer.
              Si el número vuelve a escribir, se abre un chat nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className={field.error}>{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <button type="button" disabled={isPending} onClick={deleteThread} className={btn.dangerSolid}>
              {isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
