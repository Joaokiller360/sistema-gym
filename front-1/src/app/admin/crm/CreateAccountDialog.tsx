'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, Copy, ExternalLink, Loader2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { textError } from '@/lib/text-rules'
import { btn, field } from '@/components/admin/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createAccountAction, listPlansAction, type CreatedAccount, type CrmPlan, type CrmThread } from './actions'

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-3 rounded-lg border border-adm-line-soft px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-adm-muted">{label}</p>
        <p className={cn('truncate text-sm font-semibold', mono && 'font-admin-mono')}>{value}</p>
      </div>
      <button
        type="button"
        onClick={() => { void navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
        aria-label={`Copiar ${label.toLowerCase()}`}
        className={btn.icon}
      >
        {copied ? <Check className="size-4 text-adm-ok-fg" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

/** Gym + owner login for a contact that isn't a customer yet, with the details they sent in the chat. */
export function CreateAccountDialog({ thread, onCreated }: { thread: CrmThread; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [plans, setPlans] = useState<CrmPlan[]>([])
  const [gymName, setGymName] = useState('')
  const [ownerName, setOwnerName] = useState(thread.contactName ?? thread.alias ?? '')
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState('')
  const [sendWhatsapp, setSendWhatsapp] = useState(thread.windowOpen)
  const [created, setCreated] = useState<CreatedAccount | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || plans.length) return
    void listPlansAction().then(setPlans)
  }, [open, plans.length])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!gymName.trim() || !ownerName.trim() || !email.trim()) { setError('Completá gimnasio, dueño y email'); return }
    const bad = textError('name', gymName) ? `Gimnasio: ${textError('name', gymName)}` : textError('person', ownerName) ? `Dueño: ${textError('person', ownerName)}` : null
    if (bad) { setError(bad); return }
    setError(null)
    startTransition(async () => {
      const res = await createAccountAction(thread.id, {
        gymName: gymName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        ...(plan && { plan }),
        sendWhatsapp: sendWhatsapp && thread.windowOpen,
      })
      if ('error' in res) { setError(res.error); return }
      setCreated(res)
    })
  }

  function close(next: boolean) {
    setOpen(next)
    // The chat is linked now: the panel switches to the gym card
    if (!next && created) onCreated()
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(btn.dark, 'self-start')}>
        <UserPlus className="size-4" aria-hidden="true" /> Crear cuenta
      </button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="admin-surface max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{created ? 'Cuenta creada' : 'Crear cuenta'}</DialogTitle>
            <DialogDescription>
              {created
                ? 'Le llegó un email de bienvenida con el acceso. La contraseña se muestra solo esta vez.'
                : 'Crea el gimnasio y el usuario del dueño con los datos que te pasó, y vincula este chat.'}
            </DialogDescription>
          </DialogHeader>

          {created ? (
            <div className="flex flex-col gap-3">
              <CopyRow label="Usuario" value={created.email} />
              <CopyRow label="Contraseña" value={created.password} mono />
              {created.whatsapp && (
                <p className={cn('rounded-lg px-3 py-2 text-[13px]', created.whatsapp.sent ? 'bg-adm-ok-bg text-adm-ok-fg' : 'bg-adm-bad-bg text-adm-bad-fg')}>
                  {created.whatsapp.sent
                    ? 'También se los mandamos por WhatsApp (en el chat la contraseña se ve tapada).'
                    : `No se pudo mandar por WhatsApp: ${created.whatsapp.error ?? 'error desconocido'}. Pasale los datos de arriba.`}
                </p>
              )}
              <div className="flex gap-2">
                <Link href={`/admin/gyms/${created.slug}`} className={btn.line}>
                  <ExternalLink className="size-3.5" aria-hidden="true" /> Ver gimnasio
                </Link>
                <button type="button" onClick={() => close(false)} className={cn(btn.primary, 'ml-auto')}>Listo</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="block">
                <span className={field.label}>Nombre del gimnasio</span>
                <input value={gymName} onChange={e => setGymName(e.target.value)} maxLength={100} autoFocus disabled={isPending} placeholder="Ej. CrossBox Palermo" className={field.input} />
              </label>
              <label className="block">
                <span className={field.label}>Nombre del dueño</span>
                <input value={ownerName} onChange={e => setOwnerName(e.target.value)} maxLength={80} disabled={isPending} className={field.input} />
              </label>
              <label className="block">
                <span className={field.label}>Email (será su usuario)</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} disabled={isPending} placeholder="dueño@gimnasio.com" className={field.input} />
              </label>
              <label className="block">
                <span className={field.label}>Plan</span>
                <select value={plan} onChange={e => setPlan(e.target.value)} disabled={isPending} className={field.input}>
                  <option value="">Básico (por defecto)</option>
                  {plans.map(p => (
                    <option key={p.key} value={p.key}>{p.label}{p.maxMembers ? ` · hasta ${p.maxMembers} socios` : ''}</option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-adm-muted">
                WhatsApp del gimnasio: <span className="font-admin-mono">+{thread.phone}</span> (este chat)
              </p>
              <label className={cn('flex items-start gap-2.5 text-[13px]', !thread.windowOpen && 'opacity-60')}>
                <input
                  type="checkbox"
                  checked={sendWhatsapp && thread.windowOpen}
                  onChange={e => setSendWhatsapp(e.target.checked)}
                  disabled={isPending || !thread.windowOpen}
                  className="mt-0.5 size-4 accent-adm-ink"
                />
                <span>
                  Mandarle el usuario y la contraseña por este chat
                  {!thread.windowOpen && <span className="block text-xs text-adm-muted">No disponible: pasaron más de 24 h desde su último mensaje. Le llega igual por email.</span>}
                </span>
              </label>
              {error && <p role="alert" className={field.error}>{error}</p>}
              <button type="submit" disabled={isPending} className={btn.primary}>
                {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Crear cuenta
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
