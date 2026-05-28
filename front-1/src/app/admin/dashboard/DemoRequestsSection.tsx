'use client'

import { useState, useTransition } from 'react'
import { PlayCircle, CheckCircle2, XCircle, Clock, Phone, Mail, Building2 } from 'lucide-react'
import { updateDemoRequestStatusAction } from './demo-requests-actions'

export interface DemoRequest {
  id: string
  name: string
  email: string
  phone?: string | null
  gymName: string
  planLabel: string
  status: 'PENDING' | 'CONTACTED' | 'DISMISSED'
  createdAt: string
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pendiente', color: 'bg-amber-50 text-amber-600 border-amber-200', icon: Clock },
  CONTACTED: { label: 'Contactado', color: 'bg-emerald-50 text-emerald-600 border-emerald-200', icon: CheckCircle2 },
  DISMISSED: { label: 'Descartado', color: 'bg-zinc-50 text-zinc-400 border-zinc-200', icon: XCircle },
}

function DemoRequestRow({ request }: { request: DemoRequest }) {
  const [status, setStatus] = useState(request.status)
  const [isPending, startTransition] = useTransition()

  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon

  function changeStatus(next: DemoRequest['status']) {
    setStatus(next)
    startTransition(async () => {
      await updateDemoRequestStatusAction(request.id, next)
    })
  }

  return (
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
      <td className="px-5 py-3.5 hidden md:table-cell">
        <div className="flex items-center gap-1.5 text-sm text-zinc-600">
          <Building2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          {request.gymName}
        </div>
      </td>
      <td className="px-5 py-3.5 hidden sm:table-cell">
        <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 rounded-full px-2.5 py-1">
          {request.planLabel}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
          <Icon className="h-3 w-3" />
          {cfg.label}
        </span>
      </td>
      <td className="px-5 py-3.5 text-xs text-zinc-400 hidden lg:table-cell shrink-0 whitespace-nowrap">
        {new Date(request.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5 justify-end">
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
  )
}

export function DemoRequestsSection({ requests }: { requests: DemoRequest[] }) {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'CONTACTED' | 'DISMISSED'>('PENDING')

  const filtered = filter === 'ALL' ? requests : requests.filter(r => r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'PENDING').length

  if (requests.length === 0) return null

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <PlayCircle className="h-4 w-4 text-zinc-400" />
          <h2 className="font-semibold text-sm">Solicitudes de demo</h2>
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
          <PlayCircle className="h-8 w-8 mb-2 opacity-20" />
          Sin solicitudes {filter !== 'ALL' ? STATUS_CONFIG[filter as Exclude<typeof filter, 'ALL'>].label.toLowerCase() + 's' : ''}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500">Contacto</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden md:table-cell">Gimnasio</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Plan</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500">Estado</th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Fecha</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(r => (
                <DemoRequestRow key={r.id} request={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
