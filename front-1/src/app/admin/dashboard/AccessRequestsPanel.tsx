'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { CalendarClock, CheckCircle2, XCircle, Clock, Phone, Mail, Send, X, Loader2, Link, Building2, ExternalLink } from 'lucide-react'
import { updateAccessRequestStatusAction, sendAccessRequestMessageAction, convertToGymAction } from './access-requests-actions'
import { createBlockHandlers } from '@/lib/input-validation'

const urlHandlers = createBlockHandlers('url')
const textHandlers = createBlockHandlers('text')

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const h12 = h % 12 || 12
  const ampm = h >= 12 ? 'p.m.' : 'a.m.'
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h12}:${m} ${ampm}`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export interface AccessRequest {
  id: string
  name: string
  email: string
  phone?: string | null
  preferredDate: string
  status: 'PENDING' | 'CONTACTED' | 'DISMISSED'
  createdAt: string
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: Clock },
  CONTACTED: { label: 'Contactado', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: CheckCircle2 },
  DISMISSED: { label: 'Descartado', color: 'bg-zinc-50 text-zinc-400 border-zinc-200', icon: XCircle },
}

function MessageModal({ request, onClose }: { request: AccessRequest; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSend() {
    if (!message.trim()) { setError('Escribí un mensaje'); return }
    setError('')
    startTransition(async () => {
      const res = await sendAccessRequestMessageAction(request.id, message.trim(), meetingLink.trim() || undefined)
      if (res.error) setError(res.error)
      else setSent(true)
    })
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-zinc-400" />
            <h3 className="font-bold text-sm">Enviar mensaje</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Client info */}
        <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-100 space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Destinatario</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
              {request.name}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Mail className="h-3.5 w-3.5 text-zinc-400" />
              {request.email}
            </span>
            {request.phone && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Phone className="h-3.5 w-3.5 text-zinc-400" />
                {request.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <CalendarClock className="h-3.5 w-3.5 text-zinc-400" />
              {fmtDateTime(request.preferredDate)}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {sent ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-zinc-800">Mensaje enviado</p>
                <p className="text-xs text-zinc-400 mt-0.5">El correo fue enviado a {request.email}</p>
              </div>
              <button onClick={onClose} className="mt-2 text-xs font-semibold text-zinc-500 hover:text-zinc-800 underline underline-offset-2">
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Link de reunión (Zoom / Meet)
                </label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  <input
                    type="url"
                    value={meetingLink}
                    onChange={e => setMeetingLink(e.target.value)}
                    {...urlHandlers}
                    disabled={isPending}
                    placeholder="https://meet.google.com/... o https://zoom.us/j/..."
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 pl-9 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Tu mensaje
                  </label>
                  <span className="text-[11px] text-zinc-400">Plantillas:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { label: 'Confirmar reunión', text: `Hola ${request.name}, confirmamos tu reunion para la fecha solicitada. Te esperamos puntual. Cualquier consulta no dudes en escribirnos.` },
                    { label: 'Proponer horario', text: `Hola ${request.name}, recibimos tu solicitud. El horario que elegiste no esta disponible, pero podemos coordinar otro momento. Avisanos cuando podes y lo agendamos.` },
                    { label: 'Acceso aprobado', text: `Hola ${request.name}, tu acceso fue aprobado. En la reunion te mostramos todo el sistema y configuramos tu cuenta. Estamos a tu disposicion para cualquier duda.` },
                    { label: 'Mas info', text: `Hola ${request.name}, gracias por tu interes. Antes de la reunion, te compartimos algo de informacion sobre la plataforma para que llegues con contexto. Usamos el link adjunto para conectarnos.` },
                  ].map(tpl => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setMessage(tpl.text)}
                      disabled={isPending}
                      className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 hover:bg-white transition-all disabled:opacity-40"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  {...textHandlers}
                  disabled={isPending}
                  rows={5}
                  placeholder={`Hola ${request.name}, te contactamos en respuesta a tu solicitud de acceso…`}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all resize-none disabled:opacity-50"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  El correo incluirá automáticamente los datos de la solicitud del cliente.
                </p>
              </div>

              {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={onClose}
                  disabled={isPending}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={isPending || !message.trim()}
                  className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold bg-zinc-900 text-white hover:bg-zinc-700 transition-colors disabled:opacity-40"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviar correo
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ConvertToGymModal({ request, onClose }: { request: AccessRequest; onClose: () => void }) {
  const [gymName, setGymName] = useState(request.name)
  const [done, setDone] = useState<{ gymSlug: string } | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleConvert() {
    if (!gymName.trim() || gymName.trim().length < 2) { setError('Nombre inválido (mínimo 2 caracteres)'); return }
    setError('')
    startTransition(async () => {
      const res = await convertToGymAction(request.id, gymName)
      if (res.error) setError(res.error)
      else setDone({ gymSlug: res.gymSlug ?? '' })
    })
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-zinc-400" />
            <h3 className="font-bold text-sm">Convertir a nuevo gimnasio</h3>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {done ? (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <div>
                <p className="font-bold text-zinc-800">Gimnasio creado</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Se enviaron las credenciales temporales a <span className="font-semibold">{request.email}</span>
                </p>
              </div>
              {done.gymSlug && (
                <a
                  href={`/gym/${done.gymSlug}/dashboard`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ir al panel del gimnasio
                </a>
              )}
              <button onClick={onClose} className="mt-1 text-xs text-zinc-400 hover:text-zinc-700 underline underline-offset-2">Cerrar</button>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-zinc-600">
                  <Mail className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{request.email}</span>
                </div>
                {request.phone && (
                  <div className="flex items-center gap-2 text-zinc-600">
                    <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    {request.phone}
                  </div>
                )}
              </div>

              {/* Gym name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                  Nombre del gimnasio
                </label>
                <input
                  type="text"
                  value={gymName}
                  onChange={e => setGymName(e.target.value)}
                  maxLength={80}
                  disabled={isPending}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-all disabled:opacity-50"
                />
              </div>

              <p className="text-xs text-zinc-400 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-amber-700">
                Se creará una cuenta de dueño con contraseña temporal y se enviará por email a <strong>{request.email}</strong>.
              </p>

              {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={onClose} disabled={isPending} className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleConvert}
                  disabled={isPending || gymName.trim().length < 2}
                  className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold bg-zinc-900 text-white hover:bg-zinc-700 transition-colors disabled:opacity-40"
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
                  Crear gimnasio
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AccessRequestRow({ request }: { request: AccessRequest }) {
  const [status, setStatus] = useState(request.status)
  const [showModal, setShowModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon

  function changeStatus(next: AccessRequest['status']) {
    setStatus(next)
    startTransition(async () => {
      await updateAccessRequestStatusAction(request.id, next)
    })
  }

  return (
    <>
      <tr className="hover:bg-zinc-50 transition-colors">
        <td className="px-5 py-3.5">
          <p className="font-semibold text-sm text-zinc-800">{request.name}</p>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-zinc-400">
            <Mail className="h-3 w-3" />
            {request.email}
          </div>
          {request.phone && (
            <div className="flex items-center gap-1 mt-0.5 text-xs text-zinc-400">
              <Phone className="h-3 w-3" />
              {request.phone}
            </div>
          )}
        </td>
        <td className="px-5 py-3.5 hidden sm:table-cell">
          <div className="flex items-center gap-1.5 text-sm text-zinc-600">
            <CalendarClock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            {fmtDateTime(request.preferredDate)}
          </div>
        </td>
        <td className="px-5 py-3.5">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
            <Icon className="h-3 w-3" />
            {cfg.label}
          </span>
        </td>
        <td className="px-5 py-3.5 text-xs text-zinc-400 hidden lg:table-cell shrink-0 whitespace-nowrap">
          {fmtDate(request.createdAt)}
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1.5 justify-end">
            <button
              onClick={() => setShowConvertModal(true)}
              disabled={isPending}
              title="Convertir a nuevo gimnasio"
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:border-violet-300 hover:text-violet-600 transition-colors disabled:opacity-40"
            >
              <Building2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowModal(true)}
              disabled={isPending}
              title="Enviar mensaje por email"
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:border-blue-300 hover:text-blue-500 transition-colors disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
            {status !== 'CONTACTED' && (
              <button
                onClick={() => changeStatus('CONTACTED')}
                disabled={isPending}
                title="Marcar como contactado"
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors disabled:opacity-40"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
            )}
            {status !== 'DISMISSED' && (
              <button
                onClick={() => changeStatus('DISMISSED')}
                disabled={isPending}
                title="Descartar solicitud"
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-40"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            )}
            {status === 'DISMISSED' && (
              <button
                onClick={() => changeStatus('PENDING')}
                disabled={isPending}
                title="Restablecer a pendiente"
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:border-amber-300 hover:text-amber-600 transition-colors disabled:opacity-40"
              >
                <Clock className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {showModal && <MessageModal request={request} onClose={() => setShowModal(false)} />}
      {showConvertModal && <ConvertToGymModal request={request} onClose={() => setShowConvertModal(false)} />}
    </>
  )
}

export function AccessRequestsPanel({ requests }: { requests: AccessRequest[] }) {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'CONTACTED' | 'DISMISSED'>('PENDING')

  const filtered = filter === 'ALL' ? requests : requests.filter(r => r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'PENDING').length

  if (requests.length === 0) return null

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-zinc-400" />
          <h2 className="font-semibold text-sm">Solicitudes de acceso</h2>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
              {pendingCount}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(['ALL', 'PENDING', 'CONTACTED', 'DISMISSED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                filter === f ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
              }`}
            >
              {f === 'ALL' ? 'Todos' : STATUS_CONFIG[f].label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-sm text-zinc-400">
          <CalendarClock className="h-8 w-8 mb-2 opacity-20" />
          Sin solicitudes {filter !== 'ALL' ? STATUS_CONFIG[filter as Exclude<typeof filter, 'ALL'>].label.toLowerCase() + 's' : ''}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500">Contacto</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Fecha preferida</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500">Estado</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Recibida</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(r => (
                <AccessRequestRow key={r.id} request={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
