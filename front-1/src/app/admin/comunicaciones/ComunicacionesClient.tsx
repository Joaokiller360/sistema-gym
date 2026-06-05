'use client'

import { useState, useTransition } from 'react'
import {
  Mail, Users, Building2, CheckCircle2,
  Sparkles, Send, Eye, FileText, X, Search,
  Clock, InboxIcon, Loader2, AlertCircle, Filter,
} from 'lucide-react'
import { Gym, Communication } from '@/types'
import { sendComunicacionAction } from './actions'

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const TEMPLATES = [
  {
    label: 'Bienvenida',
    subject: 'Bienvenido a la plataforma',
    body: `Hola,\n\nQueremos darte la bienvenida oficial a la plataforma. Estamos muy contentos de tenerte con nosotros.\n\nRecordá que podés acceder al soporte en cualquier momento desde tu panel. Estamos para ayudarte.\n\nSaludos,\nEl equipo`,
  },
  {
    label: 'Nueva función',
    subject: 'Nueva función disponible en tu panel',
    body: `Hola,\n\nTenemos una novedad importante para vos. Acabamos de lanzar una nueva función en tu panel que te va a facilitar mucho la gestión diaria.\n\nIngresá a tu panel y descubrila.\n\nCualquier consulta, estamos disponibles.\n\nSaludos,\nEl equipo`,
  },
  {
    label: 'Mantenimiento',
    subject: 'Mantenimiento programado',
    body: `Hola,\n\nTe informamos que el próximo [FECHA] realizaremos un mantenimiento programado entre las [HORA INICIO] y las [HORA FIN].\n\nDurante ese período el sistema puede presentar interrupciones. Pedimos disculpas por los inconvenientes.\n\nGracias por tu comprensión.\n\nSaludos,\nEl equipo`,
  },
  {
    label: 'Renovación',
    subject: 'Tu plan está por vencer',
    body: `Hola,\n\nTe avisamos que tu plan actual vence próximamente. Para continuar usando la plataforma sin interrupciones, te recomendamos renovar antes de la fecha de vencimiento.\n\nIngresá a tu panel para gestionar la renovación o contactanos si necesitás ayuda.\n\nSaludos,\nEl equipo`,
  },
]

type RecipientFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'CUSTOM'
type Tab = 'compose' | 'preview'

export function ComunicacionesClient({ gyms, history, adminName }: { gyms: Gym[]; history: Communication[]; adminName: string }) {
  const [filter, setFilter] = useState<RecipientFilter>('ALL')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [gymSearch, setGymSearch] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [senderName, setSenderName] = useState('Equipo de soporte')
  const [activeTab, setActiveTab] = useState<Tab>('compose')
  const [sent, setSent] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)
  const [sendError, setSendError] = useState('')
  const [isPending, startTransition] = useTransition()

  const activeGyms = gyms.filter(g => g.isActive)
  const inactiveGyms = gyms.filter(g => !g.isActive)

  const recipients: Gym[] = filter === 'ALL' ? gyms
    : filter === 'ACTIVE' ? activeGyms
    : filter === 'INACTIVE' ? inactiveGyms
    : gyms.filter(g => selected.has(g.id))

  const filteredGymList = gyms.filter(g =>
    g.name.toLowerCase().includes(gymSearch.toLowerCase()) ||
    g.owner?.email?.toLowerCase().includes(gymSearch.toLowerCase())
  )

  function toggleGym(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSend() {
    setSendError('')
    startTransition(async () => {
      const res = await sendComunicacionAction({
        filter, gymIds: Array.from(selected), subject, body, senderName,
      })
      if (res.error) setSendError(res.error)
      else { setSendResult({ sent: res.sent ?? 0, failed: res.failed ?? 0 }); setSent(true) }
    })
  }

  const canSend = subject.trim().length >= 5 && body.trim().length >= 10 && recipients.length > 0

  /* ── Success screen ── */
  if (sent && sendResult) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center p-8">
        <div className="h-20 w-20 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight">¡Correo enviado!</h2>
          <p className="text-zinc-400 mt-2 text-sm">
            <span className="font-bold text-zinc-700">{sendResult.sent}</span> enviado{sendResult.sent !== 1 ? 's' : ''}
            {sendResult.failed > 0 && (
              <span className="text-red-400 ml-2">· {sendResult.failed} fallido{sendResult.failed !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => { setSent(false); setSendResult(null); setSubject(''); setBody('') }}
          className="rounded-xl border border-zinc-200 px-6 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          Redactar otro
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl mx-auto">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comunicaciones</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Enviá correos a los dueños de gimnasio</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-zinc-900/10 dark:bg-white/10 flex items-center justify-center">
          <Mail className="h-5 w-5 text-zinc-700 dark:text-white" />
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">

        {/* ── Compose panel ── */}
        <div className="rounded-2xl border bg-card overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b">
            {(['compose', 'preview'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-foreground text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'compose' ? <FileText className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {tab === 'compose' ? 'Redactar' : 'Vista previa'}
              </button>
            ))}
          </div>

          {activeTab === 'compose' ? (
            <div className="p-5 sm:p-6 space-y-5">

              {/* Recipients */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Destinatarios</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    { key: 'ALL',      label: 'Todos',         count: gyms.length,         icon: Users },
                    { key: 'ACTIVE',   label: 'Activos',       count: activeGyms.length,   icon: CheckCircle2 },
                    { key: 'INACTIVE', label: 'Inactivos',     count: inactiveGyms.length, icon: Building2 },
                    { key: 'CUSTOM',   label: 'Personalizado', count: selected.size,       icon: Search },
                  ] as const).map(({ key, label, count, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all ${
                        filter === key
                          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black'
                          : 'border-border hover:border-foreground/30 text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 opacity-70" />
                      <span className="text-xs font-semibold">{label}</span>
                      <span className={`text-[11px] font-bold ${filter === key ? 'opacity-60' : 'text-muted-foreground'}`}>
                        {count} gym{count !== 1 ? 's' : ''}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Custom picker */}
                {filter === 'CUSTOM' && (
                  <div className="mt-3 rounded-xl border overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        placeholder="Buscar gimnasio..."
                        value={gymSearch}
                        onChange={e => setGymSearch(e.target.value)}
                        className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                      />
                      {selected.size > 0 && (
                        <span className="rounded-full bg-foreground text-background text-[10px] font-bold px-1.5 py-0.5 shrink-0">
                          {selected.size}
                        </span>
                      )}
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
                      {filteredGymList.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>
                      ) : filteredGymList.map(g => (
                        <label key={g.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected.has(g.id)}
                            onChange={() => toggleGym(g.id)}
                            className="rounded border-border accent-foreground"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{g.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{g.owner?.email ?? 'Sin email'}</p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            g.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                       : 'bg-muted text-muted-foreground'
                          }`}>
                            {g.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sender */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Remitente
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {['Equipo de soporte', 'Soporte técnico', adminName].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSenderName(preset)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                        senderName === preset
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground bg-muted/20'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  maxLength={60}
                  placeholder="Nombre del remitente"
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30 transition-all"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Asunto
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  maxLength={150}
                  placeholder="Ej: Nueva función disponible en tu panel"
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30 transition-all"
                />
              </div>

              {/* Templates */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Plantillas</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.label}
                      onClick={() => { setSubject(tpl.subject); setBody(tpl.body) }}
                      className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-all bg-muted/20 hover:bg-muted/50"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mensaje</label>
                  <span className={`text-[11px] ${body.length > 2800 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                    {body.length}/3000
                  </span>
                </div>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value.slice(0, 3000))}
                  rows={10}
                  placeholder="Escribí tu mensaje aquí…"
                  className="w-full rounded-xl border bg-muted/30 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30 transition-all resize-none"
                />
              </div>

              {/* Error + Send */}
              <div className="space-y-3">
                {sendError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">{sendError}</p>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {recipients.length > 0
                      ? <><span className="font-bold text-foreground">{recipients.length}</span> gimnasio{recipients.length !== 1 ? 's' : ''}</>
                      : 'Seleccioná destinatarios'}
                  </p>
                  <button
                    onClick={handleSend}
                    disabled={!canSend || isPending}
                    className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-80 transition-opacity disabled:opacity-30"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isPending ? 'Enviando…' : 'Enviar correo'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Preview tab ── */
            <div className="p-5 sm:p-6">
              <div className="rounded-2xl border overflow-hidden">
                <div className="bg-zinc-900 px-5 py-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-[#fffb00] flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-black" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">GymOS</p>
                      <p className="text-white/40 text-xs">noreply@gymos.app</p>
                    </div>
                  </div>
                  <p className="text-white/50 text-xs mb-0.5">De: <span className="text-white/70">{senderName}</span></p>
                  <p className="text-white/50 text-xs mb-1">Para: dueño@gimnasio.com</p>
                  <p className="text-white font-bold text-lg leading-tight">
                    {subject || <span className="opacity-30 italic font-normal text-base">Sin asunto</span>}
                  </p>
                </div>
                <div className="bg-white px-6 sm:px-8 py-6">
                  {body ? (
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{body}</p>
                  ) : (
                    <p className="text-zinc-300 text-sm italic">Sin contenido</p>
                  )}
                  <div className="mt-8 pt-5 border-t border-zinc-100 text-xs text-zinc-400 space-y-0.5">
                    <p>© 2026 GymOS · Todos los derechos reservados</p>
                    <p>Este correo fue enviado a los dueños registrados en la plataforma.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Recipients list */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-4 py-3.5 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Destinatarios</span>
              </div>
              <span className="text-xs font-bold text-muted-foreground">{recipients.length}</span>
            </div>
            {recipients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <Users className="h-7 w-7 opacity-20" />
                <p className="text-xs text-muted-foreground">Ninguno seleccionado</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
                {recipients.slice(0, 50).map(g => (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-black text-muted-foreground">
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{g.name}</p>
                    </div>
                    {filter === 'CUSTOM' && (
                      <button onClick={() => toggleGym(g.id)} className="text-muted-foreground/40 hover:text-red-400 transition-colors shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {recipients.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2.5">
                    +{recipients.length - 50} más
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-2xl font-black tracking-tight">{activeGyms.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Activos</p>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-2xl font-black tracking-tight">{gyms.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Historial ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Historial de envíos</h2>
          {history.length > 0 && (
            <span className="rounded-full bg-muted text-muted-foreground text-[11px] font-bold px-2 py-0.5">
              {history.length}
            </span>
          )}
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
              <InboxIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Sin envíos aún</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Los correos enviados aparecerán aquí</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card overflow-hidden divide-y divide-border/50">
            {history.map(c => (
              <div key={c.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.body}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Users className="h-2.5 w-2.5" />
                      {c.recipientIds.length} gym{c.recipientIds.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{fmtDate(c.sentAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
