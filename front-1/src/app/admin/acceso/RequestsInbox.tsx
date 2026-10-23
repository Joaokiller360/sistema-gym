'use client'

import { useState, useTransition } from 'react'
import { Building2, CheckCircle2, ExternalLink, Inbox, Link as LinkIcon, Loader2, Mail, Send } from 'lucide-react'
import { updateAccessRequestStatusAction, sendAccessRequestMessageAction, convertToGymAction } from '../dashboard/access-requests-actions'
import { updateDemoRequestStatusAction } from '../dashboard/demo-requests-actions'
import { createBlockHandlers } from '@/lib/input-validation'
import { cn } from '@/lib/utils'
import { EmptyState, Pill, btn, chip, field, initials, type Tone } from '@/components/admin/ui'

const urlHandlers = createBlockHandlers('url')
const textHandlers = createBlockHandlers('text')

export type RequestStatus = 'PENDING' | 'CONTACTED' | 'DISMISSED'

export interface AccessRequest {
  id: string
  name: string
  email: string
  phone?: string | null
  preferredDate: string
  status: RequestStatus
  createdAt: string
}

export interface DemoRequest {
  id: string
  name: string
  email: string
  phone?: string | null
  gymName: string
  planLabel: string
  status: RequestStatus
  createdAt: string
}

type Tab = 'access' | 'demo'
type Filter = 'ALL' | RequestStatus

const STATUS: Record<RequestStatus, { label: string; plural: string; tone: Tone }> = {
  PENDING: { label: 'Pendiente', plural: 'Pendientes', tone: 'warn' },
  CONTACTED: { label: 'Contactado', plural: 'Contactadas', tone: 'ok' },
  DISMISSED: { label: 'Descartado', plural: 'Descartadas', tone: 'neutral' },
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const h12 = h % 12 || 12
  const ampm = h >= 12 ? 'p.m.' : 'a.m.'
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h12}:${m} ${ampm}`
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `hace ${Math.max(1, mins)} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

function templates(name: string) {
  return [
    { label: 'Confirmar reunión', text: `Hola ${name}, confirmamos tu reunion para la fecha solicitada. Te esperamos puntual. Cualquier consulta no dudes en escribirnos.` },
    { label: 'Proponer horario', text: `Hola ${name}, recibimos tu solicitud. El horario que elegiste no esta disponible, pero podemos coordinar otro momento. Avisanos cuando podes y lo agendamos.` },
    { label: 'Acceso aprobado', text: `Hola ${name}, tu acceso fue aprobado. En la reunion te mostramos todo el sistema y configuramos tu cuenta. Estamos a tu disposicion para cualquier duda.` },
    { label: 'Más info', text: `Hola ${name}, gracias por tu interes. Antes de la reunion, te compartimos algo de informacion sobre la plataforma para que llegues con contexto. Usamos el link adjunto para conectarnos.` },
  ]
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-[1_1_180px] rounded-[10px] border border-adm-line-soft bg-adm-subtle px-3.5 py-3">
      <p className="text-xs font-semibold text-adm-muted">{label}</p>
      <div className="mt-1 truncate text-sm font-semibold">{children}</div>
    </div>
  )
}

function MessageComposer({ request }: { request: AccessRequest }) {
  const [message, setMessage] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSend() {
    if (!message.trim()) { setError('Escribí un mensaje'); return }
    setError('')
    startTransition(async () => {
      const res = await sendAccessRequestMessageAction(request.id, message.trim(), meetingLink.trim() || undefined)
      if (res.error) setError(res.error)
      else { setSent(true); setMessage(''); setMeetingLink('') }
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-adm-line-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`msg-${request.id}`} className="text-sm font-bold">Enviar mensaje</label>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-adm-muted">Plantillas:</span>
          {templates(request.name).map(tpl => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => { setMessage(tpl.text); setSent(false) }}
              disabled={isPending}
              className="min-h-8 rounded-full border border-adm-line bg-adm-subtle px-3 text-xs font-semibold transition-colors hover:border-adm-ink disabled:opacity-40"
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>
      <label className="relative block">
        <span className="sr-only">Link de reunión (Zoom / Meet)</span>
        <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-adm-muted" aria-hidden="true" />
        <input
          type="url"
          value={meetingLink}
          onChange={e => setMeetingLink(e.target.value)}
          {...urlHandlers}
          disabled={isPending}
          placeholder="Link de reunión: https://meet.google.com/…"
          className={cn(field.input, 'pl-9')}
        />
      </label>
      <textarea
        id={`msg-${request.id}`}
        value={message}
        onChange={e => { setMessage(e.target.value); setSent(false) }}
        {...textHandlers}
        disabled={isPending}
        rows={5}
        placeholder={`Hola ${request.name}, te contactamos en respuesta a tu solicitud de acceso…`}
        className={field.textarea}
      />
      <p className="-mt-1 text-xs text-adm-muted">El correo incluye automáticamente los datos de la solicitud.</p>
      {error && <p role="alert" className={field.error}>{error}</p>}
      {sent && (
        <p role="status" className="flex items-center gap-1.5 text-[13px] font-semibold text-adm-ok-fg">
          <CheckCircle2 className="size-4" aria-hidden="true" /> Mensaje enviado a {request.email}
        </p>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={handleSend} disabled={isPending || !message.trim()} className={cn(btn.dark, 'min-h-10')}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          Enviar a {request.email}
        </button>
      </div>
    </div>
  )
}

function ConvertToGym({ request }: { request: AccessRequest }) {
  const [open, setOpen] = useState(false)
  const [gymName, setGymName] = useState(request.name)
  const [done, setDone] = useState<{ gymSlug: string } | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleConvert() {
    if (!gymName.trim() || gymName.trim().length < 2) { setError('Nombre inválido (mínimo 2 caracteres)'); return }
    setError('')
    startTransition(async () => {
      const res = await convertToGymAction(request.id, gymName)
      if (res.error) setError(res.error)
      else setDone({ gymSlug: res.gymSlug ?? '' })
    })
  }

  if (done) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-adm-ok-line bg-adm-ok-bg p-4 text-adm-ok-fg">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-semibold">
          Gimnasio creado. Se enviaron las credenciales temporales a {request.email}.
        </p>
        {done.gymSlug && (
          <a href={`/gym/${done.gymSlug}/dashboard`} target="_blank" rel="noopener noreferrer" className={btn.line}>
            <ExternalLink className="size-3.5" aria-hidden="true" /> Ir al panel
          </a>
        )}
      </div>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btn.primary}>
        <Building2 className="size-4" aria-hidden="true" />
        Convertir en gimnasio
      </button>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border-2 border-adm-ink p-4">
      <p className="text-sm font-bold">Convertir en gimnasio</p>
      <label className="block">
        <span className={field.label}>Nombre del gimnasio</span>
        <input type="text" value={gymName} onChange={e => setGymName(e.target.value)} maxLength={80} disabled={isPending} className={field.input} />
      </label>
      <p className="rounded-[10px] border border-adm-warn-line bg-adm-warn-bg px-3 py-2.5 text-xs text-adm-warn-fg">
        Se crea una cuenta de dueño con contraseña temporal y se envía por email a <strong>{request.email}</strong>.
      </p>
      {error && <p role="alert" className={field.error}>{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} disabled={isPending} className={btn.line}>Cancelar</button>
        <button type="button" onClick={handleConvert} disabled={isPending || gymName.trim().length < 2} className={btn.dark}>
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Building2 className="size-4" aria-hidden="true" />}
          Crear gimnasio
        </button>
      </div>
    </div>
  )
}

function StatusActions({ status, onChange, disabled }: { status: RequestStatus; onChange: (s: RequestStatus) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'CONTACTED' && (
        <button type="button" onClick={() => onChange('CONTACTED')} disabled={disabled} className={btn.line}>
          <CheckCircle2 className="size-4" aria-hidden="true" /> Marcar contactado
        </button>
      )}
      {status !== 'DISMISSED' && (
        <button type="button" onClick={() => onChange('DISMISSED')} disabled={disabled} className={btn.line}>Descartar</button>
      )}
      {status !== 'PENDING' && (
        <button type="button" onClick={() => onChange('PENDING')} disabled={disabled} className={btn.line}>Volver a pendiente</button>
      )}
    </div>
  )
}

export function RequestsInbox({
  accessRequests,
  demoRequests,
  initialTab = 'access',
}: {
  accessRequests: AccessRequest[]
  demoRequests: DemoRequest[]
  initialTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, RequestStatus>>({})
  const [isPending, startTransition] = useTransition()

  const withStatus = <T extends { id: string; status: RequestStatus }>(list: T[]) =>
    list.map(r => (overrides[r.id] ? { ...r, status: overrides[r.id] } : r))
  const access = withStatus(accessRequests)
  const demos = withStatus(demoRequests)
  const current: (AccessRequest | DemoRequest)[] = tab === 'access' ? access : demos

  const sorted = [...current].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const shown = sorted.filter(r => filter === 'ALL' || r.status === filter)
  const selected = shown.find(r => r.id === selectedId) ?? shown[0] ?? null

  function changeStatus(id: string, next: RequestStatus) {
    setOverrides(prev => ({ ...prev, [id]: next }))
    startTransition(async () => {
      if (tab === 'access') await updateAccessRequestStatusAction(id, next)
      else await updateDemoRequestStatusAction(id, next)
    })
  }

  const pending = (list: { status: RequestStatus }[]) => list.filter(r => r.status === 'PENDING').length

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Tipo de solicitud" className="flex border-b border-adm-line">
        {([['access', 'Acceso', access], ['demo', 'Demos', demos]] as const).map(([key, label, list]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => { setTab(key); setSelectedId(null) }}
            className={cn(
              'mr-5 -mb-px flex min-h-11 items-center gap-2 border-b-[3px] px-1 text-[15px] font-bold transition-colors',
              tab === key ? 'border-adm-ink text-adm-ink' : 'border-transparent text-adm-muted hover:text-adm-ink',
            )}
          >
            {label}
            {pending(list) > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-adm-brand px-1.5 font-admin-mono text-[11px] font-bold text-adm-night">
                {pending(list)}
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Estado" className="flex flex-wrap gap-2">
        {(['PENDING', 'CONTACTED', 'DISMISSED', 'ALL'] as const).map(f => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => { setFilter(f); setSelectedId(null) }}
            className={chip(filter === f)}
          >
            {f === 'ALL' ? 'Todas' : STATUS[f].plural}
            <span className="font-admin-mono text-xs opacity-75">
              {f === 'ALL' ? current.length : current.filter(r => r.status === f).length}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <section aria-label="Listado" className="min-w-0 flex-[1_1_340px] overflow-hidden rounded-2xl border border-adm-line bg-adm-surface">
          <div className="bg-adm-subtle px-4 py-3 text-xs font-semibold text-adm-muted">Más recientes primero</div>
          {shown.length === 0 ? (
            <EmptyState icon={<Inbox className="size-8" />}>
              {filter === 'ALL' ? 'Todavía no llegaron solicitudes.' : `Sin solicitudes ${STATUS[filter].plural.toLowerCase()}.`}
            </EmptyState>
          ) : (
            <ul>
              {shown.map(r => {
                const on = selected?.id === r.id
                const sub = 'gymName' in r ? `${r.gymName} · ${r.planLabel}` : `Prefiere ${fmtDateTime(r.preferredDate)}`
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        'flex w-full items-start gap-3 border-t border-adm-line-soft px-4 py-3.5 text-left transition-colors',
                        on ? 'bg-[#fffde0] shadow-[inset_3px_0_0_var(--adm-ink)] dark:bg-[#24230f]' : 'hover:bg-adm-subtle',
                      )}
                    >
                      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-adm-chip text-xs font-extrabold">
                        {initials(r.name)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex justify-between gap-2">
                          <span className="truncate text-sm font-bold">{r.name}</span>
                          <span className="shrink-0 text-xs text-adm-muted">{timeAgo(r.createdAt)}</span>
                        </span>
                        <span className="truncate text-[13px] text-adm-muted">{sub}</span>
                        <span><Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill></span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {selected && (
          <section aria-labelledby="req-h" className="flex min-w-0 flex-[2_1_480px] flex-col gap-5 rounded-2xl border border-adm-line bg-adm-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-adm-ink text-base font-extrabold text-adm-surface">
                  {initials(selected.name)}
                </div>
                <div className="min-w-0">
                  <h2 id="req-h" className="truncate text-2xl font-extrabold">{selected.name}</h2>
                  <p className="mt-0.5 truncate text-sm text-adm-muted">
                    {'gymName' in selected ? selected.gymName : 'Solicitud de acceso'}
                  </p>
                </div>
              </div>
              <Pill tone={STATUS[selected.status].tone} className="px-3 py-1 text-xs">{STATUS[selected.status].label}</Pill>
            </div>

            <div className="flex flex-wrap gap-2">
              <Fact label="Email"><a href={`mailto:${selected.email}`} className="hover:underline">{selected.email}</a></Fact>
              <Fact label="Teléfono">
                {selected.phone ? <a href={`tel:${selected.phone}`} className="font-admin-mono hover:underline">{selected.phone}</a> : '—'}
              </Fact>
              {'gymName' in selected ? (
                <Fact label="Plan de interés">{selected.planLabel}</Fact>
              ) : (
                <Fact label="Fecha preferida">{fmtDateTime(selected.preferredDate)}</Fact>
              )}
              <Fact label="Recibida">{fmtDateTime(selected.createdAt)}</Fact>
            </div>

            {'preferredDate' in selected ? (
              <MessageComposer key={selected.id} request={selected} />
            ) : (
              <a href={`mailto:${selected.email}?subject=${encodeURIComponent('Tu demo de la plataforma')}`} className={cn(btn.dark, 'min-h-10 self-start')}>
                <Mail className="size-4" aria-hidden="true" /> Escribir por email
              </a>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-line-soft pt-4">
              <StatusActions status={selected.status} onChange={s => changeStatus(selected.id, s)} disabled={isPending} />
              {'preferredDate' in selected && (
                <ConvertToGym key={selected.id} request={selected} />
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
