'use client'

import { useRef, useState, useTransition } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btn, field } from '@/components/admin/ui'
import { createTemplateAction } from './actions'

const CATEGORIES = [
  { key: 'UTILITY', label: 'Utilidad', hint: 'Avisos sobre la cuenta, pagos o el servicio' },
  { key: 'MARKETING', label: 'Marketing', hint: 'Promociones, ofertas y novedades' },
] as const

/** Meta's name rule: lowercase, digits and underscores, starting with a letter */
function slug(raw: string) {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .slice(0, 100)
}

/** Highest {{n}} in the text */
function varCount(text: string) {
  return Math.max(0, ...[...text.matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1])))
}

/** Submits a new template to Meta's review; it shows up as "En revisión" until approved. */
export function NewTemplateForm({ onCreated, onCancel }: { onCreated: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<'UTILITY' | 'MARKETING'>('UTILITY')
  const [body, setBody] = useState('')
  const [examples, setExamples] = useState<string[]>([])
  const [footer, setFooter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const vars = varCount(body)

  function changeBody(next: string) {
    setBody(next)
    const n = varCount(next)
    setExamples(ex => Array.from({ length: n }, (_, i) => ex[i] ?? ''))
  }

  /** Inserts the next {{n}} where the cursor is */
  function addVariable() {
    const el = bodyRef.current
    const hole = `{{${vars + 1}}}`
    const at = el?.selectionStart ?? body.length
    changeBody(body.slice(0, at) + hole + body.slice(el?.selectionEnd ?? at))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + hole.length, at + hole.length)
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !body.trim()) { setError('Poné un nombre y el mensaje'); return }
    if (examples.some(x => !x.trim())) { setError('Poné un ejemplo para cada variable'); return }
    setError(null)
    startTransition(async () => {
      const res = await createTemplateAction({ name, category, language: 'es', body: body.trim(), examples, footer: footer.trim() || undefined })
      if (res.error) { setError(res.error); return }
      onCreated(name)
    })
  }

  const preview = body.replace(/\{\{(\d+)\}\}/g, (hole, i: string) => examples[Number(i) - 1]?.trim() || hole)

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex min-w-0 flex-col gap-4">
        <label className="block">
          <span className={field.label}>Nombre</span>
          <input
            value={name}
            onChange={e => setName(slug(e.target.value))}
            maxLength={100}
            autoFocus
            disabled={isPending}
            placeholder="aviso_pago_vencido"
            className={cn(field.input, 'font-admin-mono')}
          />
          <span className={field.hint}>Solo lo ves vos. Minúsculas y guiones bajos.</span>
        </label>

        <fieldset>
          <legend className={field.label}>Tipo</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map(c => (
              <label
                key={c.key}
                className={cn(
                  'flex cursor-pointer flex-col rounded-xl border px-3 py-2.5 transition-colors',
                  category === c.key ? 'border-adm-ink bg-adm-chip' : 'border-adm-line hover:border-adm-ink',
                )}
              >
                <input type="radio" name="tpl-category" value={c.key} checked={category === c.key} onChange={() => setCategory(c.key)} className="sr-only" />
                <span className="text-sm font-bold">{c.label}</span>
                <span className="text-xs text-adm-muted">{c.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="tpl-body" className={cn(field.label, 'mb-0')}>Mensaje</label>
            <button type="button" onClick={addVariable} disabled={isPending} className={btn.link}>
              <Plus className="size-3.5" aria-hidden="true" /> Agregar variable
            </button>
          </div>
          <textarea
            id="tpl-body"
            ref={bodyRef}
            value={body}
            onChange={e => changeBody(e.target.value)}
            maxLength={1024}
            rows={6}
            disabled={isPending}
            placeholder={'Hola {{1}}, te recordamos que tu plan vence el {{2}}. Respondé este mensaje si necesitás ayuda.'}
            className={field.textarea}
          />
          <span className={field.hint}>Las variables ({'{{1}}'}, {'{{2}}'}…) se completan al enviar. No pueden ir al principio ni al final.</span>
        </div>

        {vars > 0 && (
          <div>
            <p className={field.label}>Ejemplos para la revisión</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {examples.map((v, i) => (
                <label key={i} className="flex items-center gap-2">
                  <span className="w-9 shrink-0 font-admin-mono text-xs text-adm-muted">{`{{${i + 1}}}`}</span>
                  <input
                    value={v}
                    onChange={e => setExamples(ex => ex.map((x, j) => (j === i ? e.target.value : x)))}
                    maxLength={200}
                    disabled={isPending}
                    placeholder={i === 0 ? 'Ej. Martina' : 'Ej. 15 de noviembre'}
                    className={field.input}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <label className="block">
          <span className={field.label}>Pie (opcional)</span>
          <input value={footer} onChange={e => setFooter(e.target.value)} maxLength={60} disabled={isPending} placeholder="Equipo de soporte" className={field.input} />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <p className={field.label}>Así llega</p>
        <div className="rounded-xl rounded-br-md bg-adm-ink px-3.5 py-2.5 text-sm leading-relaxed text-adm-surface">
          <p className="whitespace-pre-wrap">{preview || 'Escribí el mensaje para verlo acá.'}</p>
          {footer.trim() && <p className="mt-1.5 text-xs opacity-60">{footer.trim()}</p>}
        </div>
        <p className="text-xs text-adm-muted">
          WhatsApp la revisa antes de habilitarla; puede tardar hasta 24 h. Mientras tanto aparece como «En revisión» y cuando la aprueben queda lista para enviar.
        </p>
        {error && <p role="alert" className={field.error}>{error}</p>}
        <div className="mt-auto flex gap-2">
          <button type="button" onClick={onCancel} disabled={isPending} className={btn.line}>Cancelar</button>
          <button type="submit" disabled={isPending} className={cn(btn.primary, 'flex-1')}>
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Enviar a revisión
          </button>
        </div>
      </div>
    </form>
  )
}
