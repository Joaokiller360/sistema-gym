'use client'

import { useState, useTransition } from 'react'
import { Mail, CheckCircle2, Send, X, Search, Inbox, Loader2, AlertCircle } from 'lucide-react'
import { Gym, Communication } from '@/types'
import { cn } from '@/lib/utils'
import { NewsSection } from '@/app/gym/[gymSlug]/dashboard/NewsSection'
import { TutorialsSection } from '@/app/gym/[gymSlug]/dashboard/TutorialsSection'
import { EmptyState, PageHeader, Panel, Pill, btn, field, initials } from '@/components/admin/ui'
import { sendComunicacionAction } from './actions'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
type Section = 'mail' | 'news'

export function ComunicacionesClient({
  gyms,
  history,
  adminName,
  saasName,
}: {
  gyms: Gym[]
  history: Communication[]
  adminName: string
  saasName: string
}) {
  const [section, setSection] = useState<Section>('mail')
  const [filter, setFilter] = useState<RecipientFilter>('ALL')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [gymSearch, setGymSearch] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [senderName, setSenderName] = useState('Equipo de soporte')
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)
  const [sendError, setSendError] = useState('')
  const [isPending, startTransition] = useTransition()

  const activeGyms = gyms.filter(g => g.isActive)
  const inactiveGyms = gyms.filter(g => !g.isActive)

  const recipients: Gym[] = filter === 'ALL' ? gyms
    : filter === 'ACTIVE' ? activeGyms
    : filter === 'INACTIVE' ? inactiveGyms
    : gyms.filter(g => selected.has(g.id))

  const q = gymSearch.toLowerCase()
  const filteredGymList = gyms.filter(g => g.name.toLowerCase().includes(q) || g.owner?.email?.toLowerCase().includes(q))

  function toggleGym(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
      else setSendResult({ sent: res.sent ?? 0, failed: res.failed ?? 0 })
    })
  }

  const canSend = subject.trim().length >= 5 && body.trim().length >= 10 && recipients.length > 0

  const RECIPIENT_OPTIONS = [
    { key: 'ALL', label: 'Todos', count: gyms.length },
    { key: 'ACTIVE', label: 'Activos', count: activeGyms.length },
    { key: 'INACTIVE', label: 'Inactivos', count: inactiveGyms.length },
    { key: 'CUSTOM', label: 'Personalizado', count: selected.size },
  ] as const

  return (
    <>
      <PageHeader eyebrow="Correos a los dueños y contenido para los paneles de cada gimnasio" title="Comunicaciones" />

      <div role="tablist" aria-label="Sección" className="flex border-b border-adm-line">
        {([['mail', 'Correos'], ['news', 'Novedades y tutoriales']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            onClick={() => setSection(key)}
            className={cn(
              'mr-5 -mb-px min-h-11 border-b-[3px] px-1 text-[15px] font-bold transition-colors',
              section === key ? 'border-adm-ink text-adm-ink' : 'border-transparent text-adm-muted hover:text-adm-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'news' ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-adm-muted">Lo que publiques acá aparece en el dashboard de todos los gimnasios.</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <NewsSection canManage />
            <TutorialsSection canManage />
          </div>
        </div>
      ) : sendResult ? (
        <section role="status" className="flex flex-col items-center gap-5 rounded-2xl border border-adm-line bg-adm-surface px-6 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-adm-ok-bg">
            <CheckCircle2 className="size-8 text-adm-ok-fg" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">Correo enviado</h2>
            <p className="mt-2 text-sm text-adm-muted">
              <strong className="text-adm-ink">{sendResult.sent}</strong> enviado{sendResult.sent !== 1 ? 's' : ''}
              {sendResult.failed > 0 && <span className="ml-2 font-semibold text-adm-bad-fg">· {sendResult.failed} fallido{sendResult.failed !== 1 ? 's' : ''}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setSendResult(null); setSubject(''); setBody('') }}
            className={cn(btn.line, 'min-h-11 text-sm')}
          >
            Redactar otro
          </button>
        </section>
      ) : (
        <div className="flex flex-wrap items-start gap-4">
          <section aria-label="Redactar" className="flex min-w-0 flex-[3_1_520px] flex-col gap-5 rounded-2xl border border-adm-line bg-adm-surface p-6">
            <div>
              <span className={field.label} id="rcpt-label">Destinatarios</span>
              <div role="radiogroup" aria-labelledby="rcpt-label" className="flex flex-wrap gap-2">
                {RECIPIENT_OPTIONS.map(({ key, label, count }) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={filter === key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'flex min-w-0 flex-1 basis-32 flex-col items-start gap-0.5 rounded-xl border px-3.5 py-3 text-left transition-colors',
                      filter === key ? 'border-adm-ink bg-adm-ink text-adm-surface' : 'border-adm-line hover:border-adm-ink',
                    )}
                  >
                    <span className="text-[13px] font-bold">{label}</span>
                    <span className={cn('font-admin-mono text-xs', filter === key ? 'opacity-70' : 'text-adm-muted')}>
                      {count} gym{count !== 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
              </div>

              {filter === 'CUSTOM' && (
                <div className="mt-3 overflow-hidden rounded-xl border border-adm-line">
                  <label className="flex items-center gap-2 border-b border-adm-line-soft bg-adm-subtle px-3">
                    <Search className="size-4 shrink-0 text-adm-muted" aria-hidden="true" />
                    <span className="sr-only">Buscar gimnasio</span>
                    <input
                      type="search"
                      placeholder="Buscar gimnasio o email…"
                      value={gymSearch}
                      onChange={e => setGymSearch(e.target.value)}
                      className="min-h-11 flex-1 bg-transparent text-sm focus:outline-none"
                    />
                    {selected.size > 0 && <Pill tone="ok">{selected.size}</Pill>}
                  </label>
                  <div className="max-h-56 overflow-y-auto">
                    {filteredGymList.length === 0 ? (
                      <p className="py-4 text-center text-xs text-adm-muted">Sin resultados</p>
                    ) : filteredGymList.map(g => (
                      <label key={g.id} className="flex cursor-pointer items-center gap-3 border-t border-adm-line-soft px-3 py-2.5 first:border-t-0 hover:bg-adm-subtle">
                        <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggleGym(g.id)} className="size-[18px] accent-adm-ink" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{g.name}</span>
                          <span className="block truncate text-xs text-adm-muted">{g.owner?.email ?? 'Sin email'}</span>
                        </span>
                        <Pill tone={g.isActive ? 'ok' : 'neutral'}>{g.isActive ? 'Activo' : 'Inactivo'}</Pill>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="sender" className={field.label}>Remitente</label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {['Equipo de soporte', 'Soporte técnico', adminName].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={senderName === preset}
                    onClick={() => setSenderName(preset)}
                    className={cn(
                      'min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                      senderName === preset ? 'border-adm-ink bg-adm-ink text-adm-surface' : 'border-adm-line bg-adm-subtle hover:border-adm-ink',
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input id="sender" type="text" value={senderName} onChange={e => setSenderName(e.target.value)} maxLength={60} placeholder="Nombre del remitente" className={field.input} />
            </div>

            <div>
              <label htmlFor="subject" className={field.label}>Asunto</label>
              <input id="subject" type="text" value={subject} onChange={e => setSubject(e.target.value)} maxLength={150} placeholder="Ej: Nueva función disponible en tu panel" className={field.input} />
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="body" className={cn(field.label, 'mb-0')}>Mensaje</label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-adm-muted">Plantillas:</span>
                  {TEMPLATES.map(tpl => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => { setSubject(tpl.subject); setBody(tpl.body) }}
                      className="min-h-8 rounded-full border border-adm-line bg-adm-subtle px-3 text-xs font-semibold transition-colors hover:border-adm-ink"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                id="body"
                value={body}
                onChange={e => setBody(e.target.value.slice(0, 3000))}
                rows={10}
                placeholder="Escribí tu mensaje aquí…"
                className={cn(field.textarea, 'min-h-56')}
              />
              <p className={cn(field.hint, 'text-right', body.length > 2800 && 'font-semibold text-adm-warn-fg')}>{body.length}/3000</p>
            </div>
          </section>

          <aside aria-label="Vista previa y envío" className="flex min-w-0 flex-[2_1_340px] flex-col gap-4">
            <section aria-label="Vista previa" className="overflow-hidden rounded-2xl border border-adm-line">
              <div className="adm-night bg-adm-night px-5 py-5 text-white">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-adm-brand">
                    <Mail className="size-4 text-adm-night" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{saasName}</p>
                    <p className="text-xs text-[#a3a39d]">Vista previa del correo</p>
                  </div>
                </div>
                <p className="text-xs text-[#a3a39d]">De: <span className="text-white">{senderName || '—'}</span></p>
                <p className="mt-2 text-lg font-bold leading-tight">
                  {subject || <span className="text-base font-normal italic text-[#85857f]">Sin asunto</span>}
                </p>
              </div>
              <div className="bg-white px-6 py-6 text-zinc-800">
                {body
                  ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
                  : <p className="text-sm italic text-zinc-500">Sin contenido</p>}
                <div className="mt-8 border-t border-zinc-100 pt-5 text-xs text-zinc-500">
                  Enviado a los dueños registrados en {saasName}.
                </div>
              </div>
            </section>

            <Panel
              title="Destinatarios"
              id="rcpt-h"
              action={<span className="font-admin-mono text-[13px] font-bold">{recipients.length}</span>}
            >
              {recipients.length === 0 ? (
                <EmptyState>Ninguno seleccionado</EmptyState>
              ) : (
                <ul className="max-h-56 overflow-y-auto">
                  {recipients.slice(0, 50).map(g => (
                    <li key={g.id} className="flex items-center gap-3 border-t border-adm-line-soft px-4 py-2.5 first:border-t-0">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-adm-chip text-[11px] font-extrabold">{initials(g.name)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.name}</span>
                      {filter === 'CUSTOM' && (
                        <button type="button" onClick={() => toggleGym(g.id)} aria-label={`Quitar ${g.name}`} className={cn(btn.icon, 'size-8')}>
                          <X className="size-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                  {recipients.length > 50 && (
                    <li className="py-2.5 text-center text-xs text-adm-muted">+{recipients.length - 50} más</li>
                  )}
                </ul>
              )}
            </Panel>

            {sendError && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-adm-bad-line bg-adm-bad-bg px-3.5 py-3">
                <AlertCircle className="size-4 shrink-0 text-adm-bad-fg" aria-hidden="true" />
                <p className="text-[13px] font-semibold text-adm-bad-fg">{sendError}</p>
              </div>
            )}
            <button type="button" onClick={handleSend} disabled={!canSend || isPending} className={cn(btn.primary, 'min-h-12')}>
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              {isPending ? 'Enviando…' : recipients.length > 0 ? `Enviar a ${recipients.length} gimnasio${recipients.length !== 1 ? 's' : ''}` : 'Elegí destinatarios'}
            </button>
            {!canSend && recipients.length > 0 && (
              <p className="-mt-2 text-center text-xs text-adm-muted">Asunto de 5+ caracteres y mensaje de 10+.</p>
            )}
          </aside>
        </div>
      )}

      {section === 'mail' && (
        <Panel
          title="Historial de envíos"
          id="hist-h"
          action={history.length > 0 ? <span className="font-admin-mono text-[13px] text-adm-muted">{history.length}</span> : undefined}
        >
          {history.length === 0 ? (
            <EmptyState icon={<Inbox className="size-8" />}>Los correos enviados aparecen acá.</EmptyState>
          ) : (
            <ul>
              {history.map(c => (
                <li key={c.id} className="flex items-start gap-4 border-t border-adm-line-soft px-5 py-4 first:border-t-0">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-adm-chip">
                    <Mail className="size-4 text-adm-muted" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.subject}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-adm-muted">{c.body}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-adm-muted">
                    <p className="font-admin-mono">{c.recipientIds.length} gym{c.recipientIds.length !== 1 ? 's' : ''}</p>
                    <p className="mt-0.5">{fmtDate(c.sentAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </>
  )
}
