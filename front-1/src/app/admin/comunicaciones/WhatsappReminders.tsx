'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, MessageCircle, Search } from 'lucide-react'
import { Gym } from '@/types'
import { cn } from '@/lib/utils'
import { EmptyState, Panel, Pill, btn, field, initials } from '@/components/admin/ui'

const TEMPLATES = [
  {
    label: 'Renovación',
    body: 'Hola {nombre}, te escribimos de {plataforma}. Te recordamos que el plan de {gym} vence pronto. Si quieres renovarlo o tienes dudas, respóndenos por aquí.',
  },
  {
    label: 'Pago pendiente',
    body: 'Hola {nombre}, te escribimos de {plataforma}. La suscripción de {gym} tiene un pago pendiente. Para evitar la suspensión del panel, regularízalo cuando puedas. ¡Gracias!',
  },
  {
    label: 'Prueba por vencer',
    body: 'Hola {nombre}, la prueba gratuita de {gym} en {plataforma} termina pronto. ¿Te ayudamos a elegir un plan para seguir usando el panel?',
  },
  {
    label: 'Mantenimiento',
    body: 'Hola {nombre}, te avisamos que el [FECHA] entre las [HORA] haremos un mantenimiento en {plataforma}. El panel de {gym} puede tener interrupciones breves.',
  },
]

type Filter = 'ALL' | 'ACTIVE' | 'TRIAL' | 'SUSPENDED'

const FILTERS: { key: Filter; label: string; match: (g: Gym) => boolean }[] = [
  { key: 'ALL', label: 'Todos', match: () => true },
  { key: 'ACTIVE', label: 'Activos', match: g => g.isActive },
  { key: 'TRIAL', label: 'En prueba', match: g => g.subscriptionStatus === 'TRIAL' },
  { key: 'SUSPENDED', label: 'Suspendidos', match: g => g.subscriptionStatus === 'SUSPENDED' },
]

function fill(template: string, gym: Gym, saasName: string) {
  return template
    .replaceAll('{gym}', gym.name)
    .replaceAll('{nombre}', gym.owner?.name?.split(' ')[0] ?? '')
    .replaceAll('{plataforma}', saasName)
    .replace(/ {2,}/g, ' ')
}

/** wa.me opens the admin's own WhatsApp with the text ready; nothing is sent until they press send there. */
function waLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

export function WhatsappReminders({ gyms, saasName }: { gyms: Gym[]; saasName: string }) {
  const [body, setBody] = useState(TEMPLATES[0].body)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<Set<string>>(new Set())

  const match = FILTERS.find(f => f.key === filter)!.match
  const q = query.trim().toLowerCase()
  const list = gyms
    .filter(match)
    .filter(g => !q || g.name.toLowerCase().includes(q) || g.owner?.name?.toLowerCase().includes(q))
    // Reachable gyms first
    .sort((a, b) => Number(!!b.whatsappPhone) - Number(!!a.whatsappPhone))
  const withPhone = list.filter(g => g.whatsappPhone).length
  const sample = list.find(g => g.whatsappPhone) ?? list[0]

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section aria-label="Mensaje" className="flex min-w-0 flex-[2_1_380px] flex-col gap-5 rounded-2xl border border-adm-line bg-adm-surface p-6">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="wa-body" className={cn(field.label, 'mb-0')}>Recordatorio</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.label}
                  type="button"
                  aria-pressed={body === tpl.body}
                  onClick={() => setBody(tpl.body)}
                  className={cn(
                    'min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                    body === tpl.body ? 'border-adm-ink bg-adm-ink text-adm-surface' : 'border-adm-line bg-adm-subtle hover:border-adm-ink',
                  )}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            id="wa-body"
            value={body}
            onChange={e => setBody(e.target.value.slice(0, 1000))}
            rows={6}
            className={cn(field.textarea, 'min-h-36')}
          />
          <p className={field.hint}>
            Usa <code className="font-admin-mono">{'{nombre}'}</code>, <code className="font-admin-mono">{'{gym}'}</code> y{' '}
            <code className="font-admin-mono">{'{plataforma}'}</code>: se reemplazan en cada mensaje.
          </p>
        </div>

        {sample && (
          <div>
            <p className={field.label}>Vista previa · {sample.name}</p>
            <div className="rounded-2xl rounded-tl-sm bg-[#dcf8c6] px-4 py-3 text-sm leading-relaxed text-[#111b21] shadow-sm">
              <p className="whitespace-pre-wrap">{fill(body, sample, saasName) || '—'}</p>
            </div>
          </div>
        )}

        <p className="text-xs text-adm-muted">
          Cada botón abre WhatsApp con el mensaje listo. Tú lo envías desde tu cuenta.
        </p>
      </section>

      <Panel
        title="Gimnasios"
        id="wa-gyms"
        action={<span className="font-admin-mono text-[13px] text-adm-muted">{withPhone}/{list.length} con WhatsApp</span>}
        className="min-w-0 flex-[3_1_480px]"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-adm-line-soft px-4 py-3">
          <div role="radiogroup" aria-label="Filtrar gimnasios" className="flex flex-wrap gap-1.5">
            {FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors',
                  filter === f.key ? 'border-adm-ink bg-adm-ink text-adm-surface' : 'border-adm-line hover:border-adm-ink',
                )}
              >
                {f.label} <span className="font-admin-mono opacity-70">{gyms.filter(f.match).length}</span>
              </button>
            ))}
          </div>
          <label className="ml-auto flex min-h-9 min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-adm-line bg-adm-subtle px-3">
            <Search className="size-4 shrink-0 text-adm-muted" aria-hidden="true" />
            <span className="sr-only">Buscar gimnasio</span>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar gimnasio o dueño…"
              className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
            />
          </label>
        </div>

        {list.length === 0 ? (
          <EmptyState>Ningún gimnasio en este filtro.</EmptyState>
        ) : (
          <ul className="max-h-[520px] overflow-y-auto">
            {list.map(g => {
              const sent = opened.has(g.id)
              return (
                <li key={g.id} className="flex items-center gap-3 border-t border-adm-line-soft px-4 py-3 first:border-t-0">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-adm-chip text-xs font-extrabold">{initials(g.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{g.name}</span>
                      {g.subscriptionStatus === 'SUSPENDED' && <Pill tone="bad">Suspendido</Pill>}
                      {g.subscriptionStatus === 'TRIAL' && <Pill tone="warn">Prueba</Pill>}
                    </span>
                    <span className="block truncate font-admin-mono text-xs text-adm-muted">
                      {g.whatsappPhone ? `+${g.whatsappPhone}` : 'Sin WhatsApp'}{g.owner?.name ? ` · ${g.owner.name}` : ''}
                    </span>
                  </span>
                  {g.whatsappPhone ? (
                    <a
                      href={waLink(g.whatsappPhone, fill(body, g, saasName))}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpened(prev => new Set(prev).add(g.id))}
                      className={cn(
                        'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-bold transition-colors',
                        sent ? 'border border-adm-line text-adm-muted hover:border-adm-ink' : 'bg-[#25d366] text-[#0b0b0c] hover:brightness-95',
                      )}
                    >
                      {sent ? <Check className="size-4" aria-hidden="true" /> : <MessageCircle className="size-4" aria-hidden="true" />}
                      {sent ? 'Abierto' : 'Enviar'}
                      <span className="sr-only"> recordatorio por WhatsApp a {g.name}</span>
                    </a>
                  ) : (
                    <Link href={`/admin/gyms/${g.slug}`} className={cn(btn.line, 'shrink-0')}>
                      Agregar número
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
