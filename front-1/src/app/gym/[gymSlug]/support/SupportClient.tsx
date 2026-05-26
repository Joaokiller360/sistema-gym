'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, AlertTriangle, Bell, ArrowUp, ArrowDown, Minus, Clock, CheckCircle2, Circle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createTicketAction, type SupportTicket, type TicketPriority, type TicketCategory, type CreateTicketInput } from './actions'
import { createHandlers } from '@/lib/input-validation'

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; icon: React.ReactNode }> = {
  URGENT: { label: 'Urgente', color: 'bg-red-50 text-red-600 border-red-200', icon: <AlertTriangle className="h-3 w-3" /> },
  HIGH: { label: 'Alta', color: 'bg-orange-50 text-orange-600 border-orange-200', icon: <ArrowUp className="h-3 w-3" /> },
  NORMAL: { label: 'Normal', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <Minus className="h-3 w-3" /> },
  LOW: { label: 'Baja', color: 'bg-zinc-50 text-zinc-500 border-zinc-200', icon: <ArrowDown className="h-3 w-3" /> },
  NOTIFICATION: { label: 'Notificación', color: 'bg-[#1fad9d]/10 text-[#0e7a70] border-[#1fad9d]/30', icon: <Bell className="h-3 w-3" /> },
}

const STATUS_CONFIG: Record<SupportTicket['status'], { label: string; icon: React.ReactNode }> = {
  OPEN: { label: 'Abierto', icon: <Circle className="h-3 w-3" /> },
  IN_PROGRESS: { label: 'En proceso', icon: <Clock className="h-3 w-3" /> },
  RESOLVED: { label: 'Resuelto', icon: <CheckCircle2 className="h-3 w-3" /> },
  CLOSED: { label: 'Cerrado', icon: <CheckCircle2 className="h-3 w-3" /> },
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  BUG: 'Error del sistema',
  BILLING: 'Facturación',
  ACCESS: 'Acceso / Permisos',
  FEATURE: 'Solicitud de función',
  OTHER: 'Otro',
}

const SECTIONS = [
  'Dashboard',
  'Miembros',
  'Membresías',
  'Planes',
  'Pagos',
  'Asistencia',
  'Entrenadores',
  'Clases',
  'Inventario',
  'Tienda',
  'Reportes',
  'Configuración',
  'Suscripción / Facturación',
  'Acceso / Login',
  'Otro',
]

const EXAMPLE_ERRORS: { section: string; title: string; description: string; priority: TicketPriority; category: TicketCategory }[] = [
  {
    section: 'Pagos',
    title: 'No puedo registrar un pago de membresía',
    description: 'Al intentar registrar un pago para un miembro, la pantalla muestra un error y el pago no se guarda. El miembro sí existe y tiene una membresía activa.',
    priority: 'URGENT',
    category: 'BUG',
  },
  {
    section: 'Miembros',
    title: 'Los datos del miembro no se guardan al editar',
    description: 'Cuando edito la información de un miembro (teléfono, dirección) y guardo, los cambios no persisten al recargar la página.',
    priority: 'HIGH',
    category: 'BUG',
  },
  {
    section: 'Suscripción / Facturación',
    title: 'El estado de suscripción no se actualiza tras el pago',
    description: 'Se registró el pago mensual correctamente pero el estado de la suscripción sigue mostrando "Vencida" en lugar de "Activa".',
    priority: 'URGENT',
    category: 'BILLING',
  },
  {
    section: 'Asistencia',
    title: 'No puedo registrar entrada de un miembro',
    description: 'Al intentar hacer check-in de un miembro, el sistema indica que no tiene membresía activa, pero sí la tiene vigente.',
    priority: 'HIGH',
    category: 'BUG',
  },
  {
    section: 'Acceso / Login',
    title: 'No recibí el correo de bienvenida con la contraseña',
    description: 'Se creó la cuenta pero no llegó el correo con la contraseña temporal. Ya revisé spam.',
    priority: 'NORMAL',
    category: 'ACCESS',
  },
  {
    section: 'Reportes',
    title: 'Los ingresos del mes se muestran en cero',
    description: 'El reporte de ingresos del mes actual aparece en $0,00 aunque hay pagos registrados para este período.',
    priority: 'NORMAL',
    category: 'BUG',
  },
]

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
  const color = status === 'OPEN' ? 'bg-amber-50 text-amber-600 border-amber-200'
    : status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-200'
    : 'bg-[#1fad9d]/10 text-[#0e7a70] border-[#1fad9d]/30'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TicketModal({
  open,
  onClose,
  onCreated,
  gymSlug,
}: {
  open: boolean
  onClose: () => void
  onCreated: (t: SupportTicket) => void
  gymSlug: string
}) {
  const [isPending, startTransition] = useTransition()
  const [section, setSection] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('NORMAL')
  const [category, setCategory] = useState<TicketCategory>('OTHER')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [step, setStep] = useState<'example' | 'form'>('example')

  function applyExample(ex: typeof EXAMPLE_ERRORS[0]) {
    setSection(ex.section)
    setTitle(ex.title)
    setDescription(ex.description)
    setPriority(ex.priority)
    setCategory(ex.category)
    setStep('form')
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!section) e.section = 'Seleccioná una sección'
    if (title.trim().length < 5) e.title = 'Mínimo 5 caracteres'
    if (description.trim().length < 10) e.description = 'Mínimo 10 caracteres'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const payload: CreateTicketInput = {
      title: `[${section}] ${title.trim()}`,
      description: description.trim(),
      priority,
      category,
    }
    startTransition(async () => {
      const res = await createTicketAction(gymSlug, payload)
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (res.ticket) onCreated(res.ticket)
      toast.success('Ticket enviado correctamente')
      onClose()
    })
  }

  function handleClose() {
    setStep('example')
    setSection('')
    setTitle('')
    setDescription('')
    setPriority('NORMAL')
    setCategory('OTHER')
    setErrors({})
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo reporte de soporte</DialogTitle>
        </DialogHeader>

        {step === 'example' ? (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">¿Tu problema es similar a alguno de estos? Seleccioná uno para pre-completar el formulario, o creá uno nuevo.</p>
            <div className="space-y-2">
              {EXAMPLE_ERRORS.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyExample(ex)}
                  className="w-full text-left rounded-xl border border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white px-4 py-3 transition-all"
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <PriorityBadge priority={ex.priority} />
                    <span className="text-xs text-zinc-400 bg-white border border-zinc-200 rounded-full px-2 py-0.5">{ex.section}</span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-700">{ex.title}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep('form')}
              className="w-full rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-500 hover:border-black hover:text-black transition-all"
            >
              + Crear ticket personalizado
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Sección del sistema</label>
              <select value={section} onChange={e => setSection(e.target.value)} disabled={isPending} className={inputClass}>
                <option value="">Seleccioná una sección…</option>
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.section && <p className="text-xs text-red-500 font-medium">{errors.section}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Título</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ej. No puedo acceder al módulo de pagos"
                disabled={isPending}
                className={inputClass}
                {...createHandlers('text')}
              />
              {errors.title && <p className="text-xs text-red-500 font-medium">{errors.title}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Prioridad</label>
                <select value={priority} onChange={e => setPriority(e.target.value as TicketPriority)} disabled={isPending} className={inputClass}>
                  {(Object.keys(PRIORITY_CONFIG) as TicketPriority[]).map(p => (
                    <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Categoría</label>
                <select value={category} onChange={e => setCategory(e.target.value as TicketCategory)} disabled={isPending} className={inputClass}>
                  {(Object.keys(CATEGORY_LABELS) as TicketCategory[]).map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Descripción detallada</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describí el problema con el mayor detalle posible: qué hiciste, qué esperabas que pasara y qué pasó en realidad…"
                rows={4}
                disabled={isPending}
                className={inputClass + ' resize-none'}
                {...createHandlers('text')}
              />
              {errors.description && <p className="text-xs text-red-500 font-medium">{errors.description}</p>}
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={isPending} className="rounded-xl bg-black px-5 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
                {isPending ? 'Enviando…' : 'Enviar ticket'}
              </button>
              <button type="button" onClick={() => setStep('example')} disabled={isPending} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
                Volver
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function SupportClient({ gymSlug, initialTickets }: { gymSlug: string; initialTickets: SupportTicket[] }) {
  const [tickets, setTickets] = useState(initialTickets)
  const [modalOpen, setModalOpen] = useState(false)

  function handleCreated(t: SupportTicket) {
    setTickets(prev => [t, ...prev])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''} enviado{tickets.length !== 1 ? 's' : ''}</p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-all"
        >
          <Plus className="h-4 w-4" />
          Nuevo ticket
        </button>
      </div>

      <TicketModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        gymSlug={gymSlug}
      />

      {/* Tickets list */}
      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-zinc-400">No hay tickets enviados aún.</p>
          <p className="text-xs text-zinc-300 mt-1">Usá "Nuevo ticket" para reportar un problema.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => (
            <div key={t.id} className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-sm leading-snug">{t.title}</p>
                <StatusBadge status={t.status} />
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">{t.description}</p>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={t.priority} />
                <span className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-full px-2 py-0.5">
                  {CATEGORY_LABELS[t.category]}
                </span>
                <span className="text-xs text-zinc-300 ml-auto">{fmt(t.createdAt)}</span>
              </div>
              {t.adminNotes && (
                <div className="rounded-xl bg-[#1fad9d]/8 border border-[#1fad9d]/20 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#0e7a70] mb-1">Respuesta del administrador</p>
                  <p className="text-sm text-zinc-600">{t.adminNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
