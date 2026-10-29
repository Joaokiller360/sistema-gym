'use client'

import { useState, useTransition } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btn, field } from '@/components/admin/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteQuickReplyAction, listQuickRepliesAction, saveQuickReplyAction, type QuickReply } from './actions'

/** Add, edit and remove the canned replies shown above the composer. Shared by the whole team. */
export function QuickRepliesDialog({
  open,
  onOpenChange,
  replies,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  replies: QuickReply[]
  onChange: (replies: QuickReply[]) => void
}) {
  // null: list view; '' : new one; id: editing that one
  const [editing, setEditing] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function edit(r?: QuickReply) {
    setEditing(r?.id ?? '')
    setLabel(r?.label ?? '')
    setText(r?.text ?? '')
    setError(null)
  }

  async function reload() {
    const res = await listQuickRepliesAction()
    if (!('error' in res)) onChange(res)
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim() || !text.trim()) { setError('Completá el nombre y el mensaje'); return }
    setError(null)
    startTransition(async () => {
      const res = await saveQuickReplyAction({ id: editing || undefined, label: label.trim(), text: text.trim() })
      if (res.error) { setError(res.error); return }
      await reload()
      setEditing(null)
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteQuickReplyAction(id)
      if (res.error) { setError(res.error); return }
      await reload()
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) setEditing(null) }}>
      {/* sm: prefix: the base DialogContent caps width at sm:max-w-sm */}
      <DialogContent className="admin-surface max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Respuestas rápidas</DialogTitle>
          <DialogDescription>Aparecen arriba del cuadro de respuesta. Al tocarlas se carga el texto para revisarlo antes de enviar.</DialogDescription>
        </DialogHeader>
        {editing !== null ? (
          <form onSubmit={save} className="flex flex-col gap-3">
            <label className="block">
              <span className={field.label}>Nombre del botón</span>
              <input value={label} onChange={e => setLabel(e.target.value)} maxLength={30} autoFocus disabled={isPending} placeholder="Ej. Horarios" className={field.input} />
            </label>
            <label className="block">
              <span className={field.label}>Mensaje</span>
              <textarea value={text} onChange={e => setText(e.target.value)} maxLength={4096} rows={5} disabled={isPending} className={field.textarea} />
            </label>
            {error && <p role="alert" className={field.error}>{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={isPending} className={btn.line}>Cancelar</button>
              <button type="submit" disabled={isPending} className={btn.primary}>
                {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Guardar
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            {replies.length === 0 ? (
              <p className="py-4 text-sm text-adm-muted">Todavía no hay respuestas rápidas.</p>
            ) : (
              <ul className="flex max-h-96 flex-col divide-y divide-adm-line-soft overflow-y-auto rounded-xl border border-adm-line-soft">
                {replies.map(r => (
                  <li key={r.id} className="flex items-start gap-3 px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{r.label}</p>
                      <p className="line-clamp-2 text-[13px] text-adm-muted">{r.text}</p>
                    </div>
                    <button type="button" onClick={() => edit(r)} disabled={isPending} aria-label={`Editar ${r.label}`} className={btn.icon}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => remove(r.id)} disabled={isPending} aria-label={`Eliminar ${r.label}`} className={cn(btn.icon, 'hover:bg-adm-bad-bg hover:text-adm-bad-fg')}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && <p role="alert" className={field.error}>{error}</p>}
            <button type="button" onClick={() => edit()} disabled={isPending} className={cn(btn.dark, 'self-start')}>
              <Plus className="size-4" aria-hidden="true" /> Nueva respuesta
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
