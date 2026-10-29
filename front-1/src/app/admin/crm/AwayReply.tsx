'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch, btn, field } from '@/components/admin/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { setAwayAction, type AwayConfig, type AwayMode } from './actions'

const MODES: { key: AwayMode; label: string; hint: string }[] = [
  { key: 'presence', label: 'Cuando no estoy en línea', hint: 'Nadie del equipo tiene el CRM abierto desde hace 2 minutos' },
  { key: 'always', label: 'Siempre', hint: 'A cada contacto que escribe, aunque estés conectado' },
]

const EXAMPLE = '¡Hola {nombre}! Gracias por escribirnos. Ahora no estamos conectados, te respondemos apenas volvamos.'

/** Auto-reply to incoming WhatsApp messages while nobody is online. At most once every 12 h per contact. */
export function AwayReply({ initial }: { initial: AwayConfig }) {
  const [cfg, setCfg] = useState(initial)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(enabled: boolean) {
    // Nothing to send yet: ask for the message first
    if (enabled && !cfg.message.trim()) { openEditor(true); return }
    const prev = cfg
    setCfg({ ...cfg, enabled })
    setError(null)
    startTransition(async () => {
      const res = await setAwayAction({ enabled })
      if (res.error) { setCfg(prev); setError(res.error) }
    })
  }

  function openEditor(enable = false) {
    setDraft({ ...cfg, enabled: enable || cfg.enabled, message: cfg.message || EXAMPLE })
    setError(null)
    setOpen(true)
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (draft.enabled && !draft.message.trim()) { setError('Escribí el mensaje'); return }
    setError(null)
    startTransition(async () => {
      const res = await setAwayAction({ enabled: draft.enabled, message: draft.message.trim(), mode: draft.mode })
      if (res.error) { setError(res.error); return }
      setCfg({ ...draft, message: draft.message.trim() })
      setOpen(false)
    })
  }

  const preview = draft.message.replace(/\{nombre\}/gi, 'Martina')

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3 rounded-xl border border-adm-line bg-adm-surface px-3.5 py-2">
        <button type="button" onClick={() => openEditor()} className="text-right">
          <p className="text-sm font-semibold">Respuesta automática</p>
          <p className="text-xs text-adm-muted underline-offset-2 hover:underline">
            {cfg.enabled ? (cfg.mode === 'always' ? 'Activa: siempre' : 'Activa: cuando no estás') : 'Apagada · Editar'}
          </p>
        </button>
        <Switch checked={cfg.enabled} onChange={toggle} disabled={isPending} label="Respuesta automática de WhatsApp" />
      </div>
      {error && !open && <p role="alert" className="text-xs font-semibold text-adm-bad-fg">{error}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="admin-surface max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Respuesta automática</DialogTitle>
            <DialogDescription>
              Se manda sola cuando un contacto escribe. Cada contacto la recibe como mucho una vez cada 12 h, y el chat
              sigue en «Por responder» para que alguien le conteste.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-4">
            <fieldset>
              <legend className={field.label}>Cuándo</legend>
              <div className="flex flex-col gap-2">
                {MODES.map(m => (
                  <label
                    key={m.key}
                    className={cn(
                      'flex cursor-pointer flex-col rounded-xl border px-3 py-2.5 transition-colors',
                      draft.mode === m.key ? 'border-adm-ink bg-adm-chip' : 'border-adm-line hover:border-adm-ink',
                    )}
                  >
                    <input type="radio" name="away-mode" value={m.key} checked={draft.mode === m.key} onChange={() => setDraft({ ...draft, mode: m.key })} className="sr-only" />
                    <span className="text-sm font-bold">{m.label}</span>
                    <span className="text-xs text-adm-muted">{m.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className={field.label}>Mensaje</span>
              <textarea
                value={draft.message}
                onChange={e => setDraft({ ...draft, message: e.target.value })}
                maxLength={1000}
                rows={4}
                disabled={isPending}
                className={field.textarea}
              />
              <span className={field.hint}>{'{nombre}'} se reemplaza por el nombre del contacto.</span>
            </label>
            {draft.message.trim() && (
              <p className="whitespace-pre-wrap rounded-xl rounded-br-md bg-adm-ink px-3.5 py-2.5 text-sm leading-relaxed text-adm-surface">{preview}</p>
            )}
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              Activada
              <Switch checked={draft.enabled} onChange={enabled => setDraft({ ...draft, enabled })} disabled={isPending} label="Activar respuesta automática" />
            </label>
            {error && <p role="alert" className={field.error}>{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={isPending} className={btn.line}>Cancelar</button>
              <button type="submit" disabled={isPending} className={btn.primary}>
                {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Guardar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
