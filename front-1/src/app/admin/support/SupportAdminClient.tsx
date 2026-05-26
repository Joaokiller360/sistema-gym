'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, Bell, ArrowUp, ArrowDown, Minus, Clock, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react'
import { updateTicketAction } from './actions'
import type { SupportTicket, TicketPriority } from '@/app/gym/[gymSlug]/support/actions'

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; icon: React.ReactNode }> = {
  URGENT: { label: 'Urgente', color: 'bg-red-50 text-red-600 border-red-200', icon: <AlertTriangle className="h-3 w-3" /> },
  HIGH: { label: 'Alta', color: 'bg-orange-50 text-orange-600 border-orange-200', icon: <ArrowUp className="h-3 w-3" /> },
  NORMAL: { label: 'Normal', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <Minus className="h-3 w-3" /> },
  LOW: { label: 'Baja', color: 'bg-zinc-50 text-zinc-500 border-zinc-200', icon: <ArrowDown className="h-3 w-3" /> },
  NOTIFICATION: { label: 'Notificación', color: 'bg-[#1fad9d]/10 text-[#0e7a70] border-[#1fad9d]/30', icon: <Bell className="h-3 w-3" /> },
}

const STATUS_OPTIONS: SupportTicket['status'][] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']

const STATUS_CONFIG: Record<SupportTicket['status'], { label: string; color: string; icon: React.ReactNode }> = {
  OPEN: { label: 'Abierto', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: <Circle className="h-3 w-3" /> },
  IN_PROGRESS: { label: 'En proceso', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <Clock className="h-3 w-3" /> },
  RESOLVED: { label: 'Resuelto', color: 'bg-[#1fad9d]/10 text-[#0e7a70] border-[#1fad9d]/30', icon: <CheckCircle2 className="h-3 w-3" /> },
  CLOSED: { label: 'Cerrado', color: 'bg-zinc-50 text-zinc-400 border-zinc-200', icon: <CheckCircle2 className="h-3 w-3" /> },
}

const CATEGORY_LABELS: Record<string, string> = {
  BUG: 'Error del sistema',
  BILLING: 'Facturación',
  ACCESS: 'Acceso / Permisos',
  FEATURE: 'Solicitud de función',
  OTHER: 'Otro',
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: SupportTicket['status'] }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TicketRow({ ticket }: { ticket: SupportTicket }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState(ticket.status)
  const [adminNotes, setAdminNotes] = useState(ticket.adminNotes ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const res = await updateTicketAction(ticket.id, { status, adminNotes: adminNotes.trim() || undefined })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('Ticket actualizado')
        router.refresh()
        setExpanded(false)
      }
    })
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.gymName && (
              <span className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-full px-2 py-0.5">
                {ticket.gymName}
              </span>
            )}
          </div>
          <p className="font-semibold text-sm">{ticket.title}</p>
          <p className="text-xs text-zinc-400">{fmt(ticket.createdAt)} · {CATEGORY_LABELS[ticket.category] ?? ticket.category}</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 px-5 py-4 space-y-4">
          <div className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Descripción</p>
            <p className="text-sm text-zinc-600 leading-relaxed">{ticket.description}</p>
          </div>

          {ticket.createdByEmail && (
            <p className="text-xs text-zinc-400">Enviado por: <span className="font-medium text-zinc-600">{ticket.createdByEmail}</span></p>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Estado</label>
            <select value={status} onChange={e => setStatus(e.target.value as SupportTicket['status'])} disabled={isPending} className={inputClass}>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Respuesta (opcional)</label>
            <textarea
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="Escribí una respuesta o nota para el gimnasio…"
              rows={3}
              disabled={isPending}
              className={inputClass + ' resize-none'}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-xl bg-black px-5 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
            >
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

type FilterStatus = SupportTicket['status'] | 'ALL'

export function SupportAdminClient({ tickets }: { tickets: SupportTicket[] }) {
  const [filter, setFilter] = useState<FilterStatus>('OPEN')

  const filtered = filter === 'ALL' ? tickets : tickets.filter(t => t.status === filter)

  const countByStatus = (s: FilterStatus) => s === 'ALL' ? tickets.length : tickets.filter(t => t.status === s).length

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as FilterStatus[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all border ${
              filter === s ? 'bg-black text-white border-black' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
            }`}
          >
            {s === 'ALL' ? 'Todos' : STATUS_CONFIG[s].label} ({countByStatus(s)})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-zinc-400">No hay tickets en esta categoría.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => <TicketRow key={t.id} ticket={t} />)}
        </div>
      )}
    </div>
  )
}
