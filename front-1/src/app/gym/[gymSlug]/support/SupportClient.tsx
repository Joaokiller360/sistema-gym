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
import { useIntlLocale, useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'
import { supportMessages } from './messages'

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'

const PRIORITY_STYLE: Record<TicketPriority, { color: string; icon: React.ReactNode }> = {
  URGENT: { color: 'bg-red-50 text-red-600 border-red-200', icon: <AlertTriangle className="h-3 w-3" /> },
  HIGH: { color: 'bg-orange-50 text-orange-600 border-orange-200', icon: <ArrowUp className="h-3 w-3" /> },
  NORMAL: { color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <Minus className="h-3 w-3" /> },
  LOW: { color: 'bg-zinc-50 text-zinc-500 border-zinc-200', icon: <ArrowDown className="h-3 w-3" /> },
  NOTIFICATION: { color: 'bg-[#1fad9d]/10 text-[#0e7a70] border-[#1fad9d]/30', icon: <Bell className="h-3 w-3" /> },
}

const STATUS_ICON: Record<SupportTicket['status'], React.ReactNode> = {
  OPEN: <Circle className="h-3 w-3" />,
  IN_PROGRESS: <Clock className="h-3 w-3" />,
  RESOLVED: <CheckCircle2 className="h-3 w-3" />,
  CLOSED: <CheckCircle2 className="h-3 w-3" />,
}

const CATEGORIES: TicketCategory[] = ['BUG', 'BILLING', 'ACCESS', 'FEATURE', 'OTHER']

// Texts for each example live in supportMessages.examples (same order)
const EXAMPLE_META: { priority: TicketPriority; category: TicketCategory }[] = [
  { priority: 'URGENT', category: 'BUG' },
  { priority: 'HIGH', category: 'BUG' },
  { priority: 'URGENT', category: 'BILLING' },
  { priority: 'HIGH', category: 'BUG' },
  { priority: 'NORMAL', category: 'ACCESS' },
  { priority: 'NORMAL', category: 'BUG' },
]

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const cfg = PRIORITY_STYLE[priority]
  const label = useT(supportMessages).priority[priority]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.color}`}>
      {cfg.icon}{label}
    </span>
  )
}

function StatusBadge({ status }: { status: SupportTicket['status'] }) {
  const label = useT(supportMessages).status[status]
  const color = status === 'OPEN' ? 'bg-amber-50 text-amber-600 border-amber-200'
    : status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-200'
    : 'bg-[#1fad9d]/10 text-[#0e7a70] border-[#1fad9d]/30'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
      {STATUS_ICON[status]}{label}
    </span>
  )
}

function fmt(iso: string, intl: string) {
  return new Date(iso).toLocaleDateString(intl, { day: '2-digit', month: 'short', year: 'numeric' })
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
  const t = useT(supportMessages)
  const tc = useT(commonMessages)
  const examples = t.examples.map((ex, i) => ({ ...ex, ...EXAMPLE_META[i] }))

  function applyExample(ex: (typeof examples)[number]) {
    setSection(ex.section)
    setTitle(ex.title)
    setDescription(ex.description)
    setPriority(ex.priority)
    setCategory(ex.category)
    setStep('form')
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!section) e.section = t.pickSection
    if (title.trim().length < 5) e.title = t.min5
    if (description.trim().length < 10) e.description = t.min10
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
      toast.success(t.sent)
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
          <DialogTitle>{t.modalTitle}</DialogTitle>
        </DialogHeader>

        {step === 'example' ? (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">{t.examplesHint}</p>
            <div className="space-y-2">
              {examples.map((ex, i) => (
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
              {t.custom}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.section}</label>
              <select value={section} onChange={e => setSection(e.target.value)} disabled={isPending} className={inputClass}>
                <option value="">{t.sectionPlaceholder}</option>
                {t.sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.section && <p className="text-xs text-red-500 font-medium">{errors.section}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.ticketTitle}</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t.titlePlaceholder}
                disabled={isPending}
                className={inputClass}
                {...createHandlers('text')}
              />
              {errors.title && <p className="text-xs text-red-500 font-medium">{errors.title}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.priorityLabel}</label>
                <select value={priority} onChange={e => setPriority(e.target.value as TicketPriority)} disabled={isPending} className={inputClass}>
                  {(Object.keys(PRIORITY_STYLE) as TicketPriority[]).map(p => (
                    <option key={p} value={p}>{t.priority[p]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.categoryLabel}</label>
                <select value={category} onChange={e => setCategory(e.target.value as TicketCategory)} disabled={isPending} className={inputClass}>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{t.category[c]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.description}</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t.descriptionPlaceholder}
                rows={4}
                disabled={isPending}
                className={inputClass + ' resize-none'}
                {...createHandlers('text')}
              />
              {errors.description && <p className="text-xs text-red-500 font-medium">{errors.description}</p>}
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={isPending} className="rounded-xl bg-black px-5 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
                {isPending ? t.sending : t.send}
              </button>
              <button type="button" onClick={() => setStep('example')} disabled={isPending} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
                {tc.back}
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
  const t = useT(supportMessages)
  const intl = useIntlLocale()

  function handleCreated(t: SupportTicket) {
    setTickets(prev => [t, ...prev])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{t.sentCount(tickets.length)}</p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-all"
        >
          <Plus className="h-4 w-4" />
          {t.newTicket}
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
          <p className="text-sm text-zinc-400">{t.empty}</p>
          <p className="text-xs text-zinc-300 mt-1">{t.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => (
            <div key={ticket.id} className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-sm leading-snug">{ticket.title}</p>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">{ticket.description}</p>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={ticket.priority} />
                <span className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-full px-2 py-0.5">
                  {t.category[ticket.category]}
                </span>
                <span className="text-xs text-zinc-300 ml-auto">{fmt(ticket.createdAt, intl)}</span>
              </div>
              {ticket.adminNotes && (
                <div className="rounded-xl bg-[#1fad9d]/8 border border-[#1fad9d]/20 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#0e7a70] mb-1">{t.adminReply}</p>
                  <p className="text-sm text-zinc-600">{ticket.adminNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
