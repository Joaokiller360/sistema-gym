'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btn, field } from '@/components/admin/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NewTemplateForm } from './NewTemplateForm'
import { deleteTemplateAction, listTemplatesAction, sendTemplateAction, type WaTemplate } from './actions'

const key = (t: WaTemplate) => `${t.name}:${t.language}`

/** Meta's review states, as the team reads them; APPROVED shows nothing */
const STATUS: Record<string, { label: string; note: string; className: string }> = {
  PENDING: { label: 'En revisión', note: 'WhatsApp la está revisando (puede tardar hasta 24 h). Cuando la aprueben vas a poder enviarla.', className: 'bg-adm-info-bg text-adm-info-fg' },
  IN_APPEAL: { label: 'En apelación', note: 'Se pidió una nueva revisión.', className: 'bg-adm-info-bg text-adm-info-fg' },
  REJECTED: { label: 'Rechazada', note: 'WhatsApp la rechazó. Eliminala y creala de nuevo cambiando el texto (suele pasar con variables al principio/final o con texto promocional en Utilidad).', className: 'bg-adm-bad-bg text-adm-bad-fg' },
  PAUSED: { label: 'Pausada', note: 'WhatsApp la pausó por quejas o baja calidad. Se reactiva sola o desde Meta.', className: 'bg-adm-warn-bg text-adm-warn-fg' },
  DISABLED: { label: 'Desactivada', note: 'WhatsApp la desactivó: ya no se puede enviar.', className: 'bg-adm-bad-bg text-adm-bad-fg' },
}

const statusOf = (t: WaTemplate) => (t.status === 'APPROVED' ? null : STATUS[t.status] ?? { label: t.status.toLowerCase(), note: 'No está aprobada todavía.', className: 'bg-adm-chip text-adm-muted' })

/** The words around {{n}}, so each field says what it fills: "…ya usa el {{3}}% de los socios…" */
function holeContext(text: string, n: number) {
  const hole = `{{${n}}}`
  const line = text.split('\n').find(l => l.includes(hole)) ?? ''
  const at = line.indexOf(hole)
  if (at < 0) return ''
  const from = Math.max(0, at - 28)
  const to = Math.min(line.length, at + hole.length + 28)
  return `${from > 0 ? '…' : ''}${line.slice(from, to).trim()}${to < line.length ? '…' : ''}`
}

/** Any approved WhatsApp template, with its {{n}} values filled in. Works with the 24 h window closed. */
export function TemplatePicker({
  conversationId,
  gymName,
  open,
  onOpenChange,
  onSent,
}: {
  conversationId: string
  /** Linked gym, if any: says where the prefilled values come from */
  gymName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent: () => void
}) {
  const [templates, setTemplates] = useState<WaTemplate[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [values, setValues] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loading, startLoading] = useTransition()

  function load(select?: string) {
    startLoading(async () => {
      const res = await listTemplatesAction(conversationId)
      if ('error' in res) { setError(res.error); setTemplates([]); return }
      setError(null)
      // Ready to send first, then the ones still in review
      setTemplates([...res].sort((a, b) => Number(b.status === 'APPROVED') - Number(a.status === 'APPROVED')))
      if (select) {
        const t = res.find(x => x.name === select)
        if (t) pick(t)
      }
    })
  }

  // Fetched on open: Meta approves or pauses templates at any time
  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the dialog opens
  }, [open, conversationId])

  const tpl = templates?.find(t => key(t) === selected) ?? null
  const preview = tpl?.preview.replace(/\{\{(\d+)\}\}/g, (hole, i: string) => values[Number(i) - 1]?.trim() || hole)

  function pick(t: WaTemplate) {
    setSelected(key(t))
    setValues(Array.from({ length: t.params }, (_, i) => t.defaults[i] ?? ''))
    setConfirmDelete(false)
    setError(null)
  }

  function remove() {
    if (!tpl) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      const res = await deleteTemplateAction(tpl.name, tpl.language)
      if (res.error) { setError(res.error); setConfirmDelete(false); return }
      setSelected(null)
      load()
    })
  }

  function send(e: React.FormEvent) {
    e.preventDefault()
    if (!tpl) return
    if (values.some(v => !v.trim())) { setError('Completá todos los valores'); return }
    setError(null)
    startTransition(async () => {
      const res = await sendTemplateAction(conversationId, { name: tpl.name, language: tpl.language, params: values })
      if (res.error) { setError(res.error); return }
      onOpenChange(false)
      setSelected(null)
      onSent()
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) setCreating(false) }}>
      {/* sm: prefix: the base DialogContent caps width at sm:max-w-sm */}
      <DialogContent className="admin-surface max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{creating ? 'Nueva plantilla' : 'Enviar plantilla'}</DialogTitle>
          <DialogDescription>
            {creating
              ? 'Se envía a WhatsApp para que la apruebe. Después la podés usar con cualquier contacto.'
              : 'Plantillas de WhatsApp. Las aprobadas se pueden enviar aunque hayan pasado más de 24 h.'}
          </DialogDescription>
        </DialogHeader>
        {creating ? (
          <NewTemplateForm onCancel={() => setCreating(false)} onCreated={n => { setCreating(false); load(n) }} />
        ) : templates === null ? (
          <div className="flex justify-center py-10 text-adm-muted"><Loader2 className="size-6 animate-spin" aria-label="Cargando" /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setCreating(true)} className={cn(btn.dark, 'flex-1')}>
                  <Plus className="size-4" aria-hidden="true" /> Nueva plantilla
                </button>
                <button type="button" onClick={() => load(tpl?.name)} disabled={loading} aria-label="Actualizar estados" title="Actualizar estados" className={cn(btn.line, 'px-2.5')}>
                  <RefreshCw className={cn('size-4', loading && 'animate-spin')} aria-hidden="true" />
                </button>
              </div>
            <ul aria-label="Plantillas" className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {templates.length === 0 && <li className="px-1 py-2 text-sm text-adm-muted">{error ?? 'Todavía no hay plantillas.'}</li>}
              {templates.map(t => (
                <li key={key(t)}>
                  <button
                    type="button"
                    aria-pressed={selected === key(t)}
                    onClick={() => pick(t)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                      selected === key(t) ? 'border-adm-ink bg-adm-chip' : 'border-adm-line-soft hover:border-adm-line',
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate font-admin-mono text-xs font-semibold">{t.name}</span>
                      {statusOf(t) && (
                        <span className={cn('shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold', statusOf(t)!.className)}>{statusOf(t)!.label}</span>
                      )}
                    </span>
                    <span className="block text-[11px] text-adm-muted">
                      {t.language} · {t.category.toLowerCase()}{t.unsupported && ' · no disponible'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            </div>
            {tpl ? (
              <form onSubmit={send} className="flex min-w-0 flex-col gap-3">
                <p className="whitespace-pre-wrap rounded-xl rounded-br-md bg-adm-ink px-3.5 py-2.5 text-sm leading-relaxed text-adm-surface">{preview}</p>
                {statusOf(tpl) && (
                  <p className={cn('rounded-lg px-3 py-2 text-[13px]', statusOf(tpl)!.className)}>
                    <strong>{statusOf(tpl)!.label}.</strong> {statusOf(tpl)!.note}
                  </p>
                )}
                {!statusOf(tpl) && !tpl.unsupported && tpl.params > 0 && (
                  <p className="text-[13px] text-adm-muted">
                    {values.every(v => v.trim())
                      ? `Completado con los datos de ${gymName ?? 'este contacto'}. Revisalo antes de enviar.`
                      : values.some(v => v.trim())
                        ? `${gymName ? `Completamos lo que sabemos de ${gymName}` : 'Este número no es de un gimnasio registrado'}: llená los campos vacíos.`
                        : 'Llená los valores para este contacto.'}
                  </p>
                )}
                {statusOf(tpl) ? null : tpl.unsupported ? (
                  <p className="text-[13px] text-adm-warn-fg">{tpl.unsupported}: todavía no se puede enviar desde el CRM.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {values.map((v, i) => (
                      <label key={i} className="block min-w-0">
                        <span className={cn(field.label, 'flex items-baseline gap-1.5')}>
                          <span className="font-admin-mono">{`{{${i + 1}}}`}</span>
                          <span className="truncate text-xs font-normal text-adm-muted">{holeContext(tpl.preview, i + 1)}</span>
                        </span>
                        <input
                          value={v}
                          onChange={e => setValues(vs => vs.map((x, j) => (j === i ? e.target.value : x)))}
                          maxLength={1024}
                          disabled={isPending}
                          autoFocus={i === 0}
                          className={cn(field.input, !v.trim() && 'border-adm-warn-line bg-adm-warn-bg/40')}
                        />
                      </label>
                    ))}
                  </div>
                )}
                {error && <p role="alert" className={field.error}>{error}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {!statusOf(tpl) && (
                    <button type="submit" disabled={isPending || !!tpl.unsupported} className={btn.primary}>
                      {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                      Enviar plantilla
                    </button>
                  )}
                  <button type="button" onClick={remove} disabled={isPending} className={cn(confirmDelete ? btn.dangerSolid : btn.danger, 'ml-auto')}>
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    {confirmDelete ? '¿Seguro? Eliminar' : 'Eliminar plantilla'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="self-center text-sm text-adm-muted">Elegí una plantilla para ver cómo llega.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
