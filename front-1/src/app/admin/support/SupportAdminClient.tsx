'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Inbox, Search } from 'lucide-react'
import { updateTicketAction } from './actions'
import type { SupportTicket, TicketPriority } from '@/app/gym/[gymSlug]/support/actions'
import { cn } from '@/lib/utils'
import { EmptyState, Pill, btn, chip, field, type Tone } from '@/components/admin/ui'

const PRIORITY: Record<TicketPriority, { label: string; tone: Tone; rank: number }> = {
  URGENT: { label: 'Urgente', tone: 'bad', rank: 0 },
  HIGH: { label: 'Alta', tone: 'high', rank: 1 },
  NORMAL: { label: 'Normal', tone: 'neutral', rank: 2 },
  LOW: { label: 'Baja', tone: 'neutral', rank: 3 },
  NOTIFICATION: { label: 'Notificación', tone: 'ok', rank: 4 },
}

const STATUS_OPTIONS: SupportTicket['status'][] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

const STATUS: Record<SupportTicket['status'], { label: string; tone: Tone }> = {
  OPEN: { label: 'Abierto', tone: 'warn' },
  IN_PROGRESS: { label: 'En proceso', tone: 'info' },
  RESOLVED: { label: 'Resuelto', tone: 'ok' },
  CLOSED: { label: 'Cerrado', tone: 'neutral' },
}

const CATEGORY_LABELS: Record<string, string> = {
  BUG: 'Error del sistema',
  BILLING: 'Facturación',
  ACCESS: 'Acceso / Permisos',
  FEATURE: 'Solicitud de función',
  OTHER: 'Otro',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `hace ${Math.max(1, mins)} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

function TicketDetail({ ticket }: { ticket: SupportTicket }) {
  const router = useRouter()
  const [status, setStatus] = useState(ticket.status)
  const [adminNotes, setAdminNotes] = useState(ticket.adminNotes ?? '')
  const [isPending, startTransition] = useTransition()
  const dirty = status !== ticket.status || adminNotes.trim() !== (ticket.adminNotes ?? '').trim()

  function handleSave() {
    startTransition(async () => {
      const res = await updateTicketAction(ticket.id, { status, adminNotes: adminNotes.trim() || undefined })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Ticket actualizado')
        router.refresh()
      }
    })
  }

  return (
    <section aria-labelledby="tk-h" className="flex min-w-0 flex-[2_1_480px] flex-col gap-5 rounded-2xl border border-adm-line bg-adm-surface p-6">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          <Pill tone={STATUS[ticket.status].tone}>{STATUS[ticket.status].label}</Pill>
          <Pill tone={PRIORITY[ticket.priority].tone}>{PRIORITY[ticket.priority].label}</Pill>
          <Pill className="font-medium">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</Pill>
        </div>
        <h2 id="tk-h" className="text-2xl font-extrabold leading-tight">{ticket.title}</h2>
        <p className="text-[13px] text-adm-muted">
          {ticket.gymName && <><strong className="font-semibold text-adm-ink">{ticket.gymName}</strong> · </>}
          {ticket.createdByEmail && <>{ticket.createdByEmail} · </>}
          {fmt(ticket.createdAt)}
        </p>
      </div>

      <div className="rounded-xl border border-adm-line-soft bg-adm-subtle px-4 py-3.5">
        <p className="mb-1.5 text-xs font-semibold text-adm-muted">Descripción</p>
        <p className="whitespace-pre-line text-sm leading-relaxed">{ticket.description}</p>
      </div>

      {ticket.adminNotes && (
        <div className="rounded-xl border border-adm-ok-line bg-adm-ok-bg px-4 py-3.5">
          <p className="mb-1.5 text-xs font-semibold text-adm-ok-fg">Respuesta enviada</p>
          <p className="whitespace-pre-line text-sm leading-relaxed">{ticket.adminNotes}</p>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-adm-line-soft pt-5">
        <div>
          <span className={field.label} id={`st-${ticket.id}`}>Estado</span>
          <div role="radiogroup" aria-labelledby={`st-${ticket.id}`} className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                onClick={() => setStatus(s)}
                disabled={isPending}
                className={cn(
                  'min-h-10 rounded-lg border px-3.5 text-[13px] font-semibold transition-colors',
                  status === s ? 'border-adm-ink bg-adm-ink text-adm-surface' : 'border-adm-line bg-adm-surface hover:border-adm-ink',
                )}
              >
                {STATUS[s].label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className={field.label}>{ticket.adminNotes ? 'Actualizar respuesta' : 'Respuesta para el gimnasio'}</span>
          <textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            placeholder="Escribí una respuesta o nota para el gimnasio…"
            rows={4}
            maxLength={2000}
            disabled={isPending}
            className={field.textarea}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { setStatus(ticket.status); setAdminNotes(ticket.adminNotes ?? '') }}
            disabled={isPending || !dirty}
            className={cn(btn.line, 'min-h-10')}
          >
            Descartar
          </button>
          <button type="button" onClick={handleSave} disabled={isPending || !dirty} className={cn(btn.dark, 'min-h-10')}>
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </section>
  )
}

type FilterStatus = SupportTicket['status'] | 'ALL'

export function SupportAdminClient({ tickets }: { tickets: SupportTicket[] }) {
  const [filter, setFilter] = useState<FilterStatus>('OPEN')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const countByStatus = (s: FilterStatus) => (s === 'ALL' ? tickets.length : tickets.filter(t => t.status === s).length)
  const q = query.trim().toLowerCase()
  const filtered = tickets
    .filter(t => filter === 'ALL' || t.status === filter)
    .filter(t => !q || t.title.toLowerCase().includes(q) || (t.gymName ?? '').toLowerCase().includes(q))
    .sort((a, b) =>
      PRIORITY[a.priority].rank - PRIORITY[b.priority].rank ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  const selected = filtered.find(t => t.id === selectedId) ?? filtered[0] ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ALL'] as FilterStatus[]).map(s => (
            <button
              key={s}
              type="button"
              aria-pressed={filter === s}
              onClick={() => { setFilter(s); setSelectedId(null) }}
              className={chip(filter === s)}
            >
              {s === 'ALL' ? 'Todos' : STATUS[s].label}
              <span className="font-admin-mono text-xs opacity-75">{countByStatus(s)}</span>
            </button>
          ))}
        </div>
        <label className="relative flex min-w-[220px] flex-[0_1_300px] items-center">
          <span className="sr-only">Buscar ticket</span>
          <Search className="pointer-events-none absolute left-3 size-4 text-adm-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedId(null) }}
            placeholder="Título o gimnasio"
            className={cn(field.input, 'min-h-10 pl-9')}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <section aria-label="Tickets" className="min-w-0 flex-[1_1_340px] overflow-hidden rounded-2xl border border-adm-line bg-adm-surface">
          <div className="bg-adm-subtle px-4 py-3 text-xs font-semibold text-adm-muted">Por prioridad, luego más recientes</div>
          {filtered.length === 0 ? (
            <EmptyState icon={<Inbox className="size-8" />}>No hay tickets en esta categoría.</EmptyState>
          ) : (
            <ul>
              {filtered.map(t => {
                const on = selected?.id === t.id
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        'flex w-full flex-col gap-1.5 border-t border-adm-line-soft px-4 py-3.5 text-left transition-colors',
                        on ? 'bg-[#fffde0] shadow-[inset_3px_0_0_var(--adm-ink)] dark:bg-[#24230f]' : 'hover:bg-adm-subtle',
                      )}
                    >
                      <span className="flex justify-between gap-2">
                        <span className="truncate text-sm font-bold">{t.title}</span>
                        <span className="shrink-0 text-xs text-adm-muted">{timeAgo(t.createdAt)}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Pill tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Pill>
                        <Pill tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Pill>
                        {t.gymName && <span className="truncate text-xs text-adm-muted">{t.gymName}</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {selected && <TicketDetail key={selected.id + selected.status + (selected.adminNotes ?? '')} ticket={selected} />}
      </div>
    </div>
  )
}
