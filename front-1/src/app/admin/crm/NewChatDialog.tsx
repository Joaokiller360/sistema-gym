'use client'

import { useState, useTransition } from 'react'
import { Loader2, MessageSquarePlus } from 'lucide-react'
import { btn, field } from '@/components/admin/ui'
import { textError } from '@/lib/text-rules'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createChatAction } from './actions'

/** Opens a thread with any number (e.g. a prospect). The first message still has to be a template. */
export function NewChatDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone) { setError('Ingresá un número'); return }
    const bad = textError('name', name)
    if (bad) { setError(bad); return }
    setError(null)
    startTransition(async () => {
      const res = await createChatAction(phone, name)
      if ('error' in res) { setError(res.error); return }
      setOpen(false)
      setPhone('')
      setName('')
      onCreated(res.id)
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn.dark}>
        <MessageSquarePlus className="size-4" aria-hidden="true" />
        Nuevo chat
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="admin-surface max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo chat</DialogTitle>
            <DialogDescription>
              Para escribirle a alguien que no te escribió, WhatsApp exige empezar con una plantilla aprobada.
            </DialogDescription>
          </DialogHeader>
          {/* PhoneInput keeps its own state: remount it on every open so it starts empty */}
          <form key={String(open)} onSubmit={submit} className="flex flex-col gap-4 py-1">
            <div>
              <label htmlFor="new-chat-phone" className={field.label}>WhatsApp</label>
              <PhoneInput
                id="new-chat-phone"
                onChange={setPhone}
                disabled={isPending}
                selectClassName={field.input}
                inputClassName={field.input}
              />
            </div>
            <label className="block">
              <span className={field.label}>Nombre (opcional)</span>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={80}
                placeholder="Ej. Carlos, Fit Center"
                disabled={isPending}
                className={field.input}
              />
              <span className={field.hint}>Se usa en el saludo de la plantilla.</span>
            </label>
            {error && <p role="alert" className={field.error}>{error}</p>}
            <button type="submit" disabled={isPending} className={btn.primary}>
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Abrir chat
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
