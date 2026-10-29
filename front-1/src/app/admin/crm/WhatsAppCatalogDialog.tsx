'use client'

import { useEffect, useState, useTransition } from 'react'
import { ExternalLink, Loader2, Send, Settings2, ShoppingBag, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch, btn, field } from '@/components/admin/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getCommerceAction, sendCatalogAction, setCommerceAction, type CommerceConfig } from './actions'

type Kind = 'catalog' | 'products'

const SKU = /^[\w.-]{1,100}$/
const MAX_SKUS = 30

const DEFAULT_BODY: Record<Kind, string> = {
  catalog: 'Mirá todo lo que ofrecemos 👇',
  products: 'Te paso lo que te comenté 👇',
}

/** Where products and photos are managed: Meta, not the CRM */
const COMMERCE_MANAGER = 'https://business.facebook.com/commerce'

/** Mock of how WhatsApp renders it, for the preview */
function Preview({ kind, body, header, skus }: { kind: Kind; body: string; header: string; skus: string[] }) {
  const cta = kind === 'catalog' ? 'Ver catálogo' : skus.length > 1 ? 'Ver artículos' : 'Ver'
  return (
    <div className="overflow-hidden rounded-xl rounded-br-md bg-adm-ink text-sm text-adm-surface">
      <div className="flex items-center gap-3 border-b border-adm-surface/15 px-3.5 py-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-adm-surface/10">
          <ShoppingBag className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold">
            {kind === 'catalog' ? 'Catálogo' : skus.length > 1 ? header || 'Título de la lista' : skus[0] || 'Producto'}
          </p>
          <p className="truncate text-xs opacity-70">
            {kind === 'catalog' ? 'Fotos y precios de tu catálogo de WhatsApp' : skus.length > 1 ? `${skus.length} artículos` : 'Foto y precio desde tu catálogo'}
          </p>
        </div>
      </div>
      <p className="whitespace-pre-wrap px-3.5 py-2.5 leading-relaxed">{body || '…'}</p>
      <p className="border-t border-adm-surface/15 py-2 text-center text-[13px] font-semibold text-[#53bdeb]">{cta}</p>
    </div>
  )
}

function Setup({ config, onSaved }: { config: CommerceConfig; onSaved: (c: CommerceConfig) => void }) {
  const [catalogId, setCatalogId] = useState(config.catalogId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save(data: Parameters<typeof setCommerceAction>[0]) {
    setError(null)
    startTransition(async () => {
      const res = await setCommerceAction(data)
      if ('error' in res && !('catalogId' in res)) { setError(res.error); return }
      onSaved(res as CommerceConfig)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-adm-muted">
        <li>
          Cargá productos, fotos y precios en{' '}
          <a href={COMMERCE_MANAGER} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-adm-ink underline underline-offset-2">
            Commerce Manager de Meta <ExternalLink className="size-3" aria-hidden="true" />
          </a>{' '}
          (o desde WhatsApp Manager › Catálogo).
        </li>
        <li>Conectá ese catálogo a tu número de WhatsApp en WhatsApp Manager › Catálogo.</li>
        <li>Copiá el ID del catálogo (Commerce Manager › Configuración) y pegalo acá. Hace falta para mandar productos sueltos.</li>
      </ol>
      <label className="block">
        <span className={field.label}>ID del catálogo</span>
        <div className="flex gap-2">
          <input
            value={catalogId}
            onChange={e => setCatalogId(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            maxLength={30}
            disabled={isPending}
            placeholder="Ej. 1234567890123456"
            className={cn(field.input, 'font-admin-mono')}
          />
          <button type="button" onClick={() => save({ catalogId })} disabled={isPending || catalogId === (config.catalogId ?? '')} className={btn.dark}>
            Guardar
          </button>
        </div>
      </label>
      <div className="flex flex-col gap-3 rounded-xl border border-adm-line-soft p-3.5">
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          <span>
            Mostrar el catálogo en el perfil
            <span className="block text-xs font-normal text-adm-muted">El ícono 🛍 al lado del nombre en WhatsApp</span>
          </span>
          <Switch checked={config.isCatalogVisible} onChange={v => save({ isCatalogVisible: v })} disabled={isPending || !!config.error} label="Mostrar el catálogo en el perfil" />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          <span>
            Permitir carrito
            <span className="block text-xs font-normal text-adm-muted">El cliente arma un pedido y te llega al chat</span>
          </span>
          <Switch checked={config.isCartEnabled} onChange={v => save({ isCartEnabled: v })} disabled={isPending || !!config.error} label="Permitir carrito" />
        </label>
        {config.error && <p className="text-xs text-adm-bad-fg">No se pudieron leer estos ajustes de WhatsApp: {config.error}</p>}
      </div>
      {isPending && <p className="flex items-center gap-1.5 text-xs text-adm-muted"><Loader2 className="size-3 animate-spin" aria-hidden="true" /> Guardando…</p>}
      {error && <p role="alert" className={field.error}>{error}</p>}
    </div>
  )
}

/** Sends from the WhatsApp Business catalog (Meta): the whole catalog, or some products by code. */
export function WhatsAppCatalogDialog({
  conversationId,
  replyToId,
  open,
  onOpenChange,
  onSent,
}: {
  conversationId: string
  /** Quote-reply target picked in the thread, if any */
  replyToId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent: () => void
}) {
  const [config, setConfig] = useState<CommerceConfig | null>(null)
  const [setup, setSetup] = useState(false)
  const [kind, setKind] = useState<Kind>('catalog')
  const [body, setBody] = useState(DEFAULT_BODY.catalog)
  const [header, setHeader] = useState('')
  const [skus, setSkus] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let live = true
    void getCommerceAction().then(res => {
      if (!live) return
      if ('catalogId' in res) setConfig(res)
      else setConfig({ catalogId: null, isCatalogVisible: false, isCartEnabled: false, error: res.error })
    })
    return () => { live = false }
  }, [open])

  function pickKind(k: Kind) {
    setKind(k)
    if (body === DEFAULT_BODY[kind]) setBody(DEFAULT_BODY[k])
    setError(null)
  }

  /** Accepts several codes pasted at once, split by spaces, commas or lines */
  function addSkus(raw: string) {
    const parts = raw.split(/[\s,;]+/).map(p => p.trim()).filter(Boolean)
    setDraft('')
    if (!parts.length) return
    const bad = parts.find(p => !SKU.test(p))
    if (bad) { setError(`"${bad}" no es un código válido (letras, números, . _ -)`); return }
    setError(null)
    setSkus(prev => [...new Set([...prev, ...parts])].slice(0, MAX_SKUS))
  }

  const needsCatalogId = kind === 'products' && !config?.catalogId
  const needsHeader = kind === 'products' && skus.length > 1

  function send() {
    if (!body.trim()) { setError('Escribí el texto del mensaje'); return }
    if (kind === 'products' && !skus.length) { setError('Agregá el código de al menos un producto'); return }
    if (needsHeader && !header.trim()) { setError('Poné un título para la lista'); return }
    setError(null)
    startTransition(async () => {
      const res = await sendCatalogAction(conversationId, {
        kind,
        body: body.trim(),
        ...(needsHeader && { header: header.trim() }),
        ...(skus.length && { skus }),
        replyToId,
      })
      if (res.error) { setError(res.error); return }
      onOpenChange(false)
      setSkus([])
      onSent()
    })
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) setSetup(false) }}>
      <DialogContent className="admin-surface max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {setup ? 'Catálogo de WhatsApp: ajustes' : 'Enviar del catálogo de WhatsApp'}
          </DialogTitle>
          <DialogDescription>
            {setup
              ? 'Los productos y las fotos se manejan en Meta; acá solo conectás el catálogo con el CRM.'
              : 'Le llega como mensaje de catálogo de WhatsApp, con fotos, precios y botón para verlo.'}
          </DialogDescription>
        </DialogHeader>

        {config === null ? (
          <div className="flex justify-center py-10 text-adm-muted"><Loader2 className="size-6 animate-spin" aria-label="Cargando" /></div>
        ) : setup ? (
          <>
            <Setup config={config} onSaved={setConfig} />
            <button type="button" onClick={() => setSetup(false)} className={cn(btn.line, 'self-start')}>Volver</button>
          </>
        ) : (
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_240px]">
            <div className="flex min-w-0 flex-col gap-4">
              <div role="group" aria-label="Qué enviar" className="flex gap-0.5 self-start rounded-[10px] bg-adm-chip p-0.5">
                {(['catalog', 'products'] as const).map(k => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => pickKind(k)}
                    className={cn(
                      'min-h-8 rounded-lg px-3 text-[13px] transition-colors',
                      kind === k ? 'bg-adm-ink font-bold text-adm-surface' : 'font-semibold text-adm-muted hover:text-adm-ink',
                    )}
                  >
                    {k === 'catalog' ? 'Catálogo completo' : 'Productos'}
                  </button>
                ))}
              </div>

              {kind === 'products' && (
                <div>
                  <label htmlFor="wa-sku" className={field.label}>Códigos de producto (SKU)</label>
                  <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-[10px] border border-adm-line px-2 py-1.5 focus-within:border-adm-muted">
                    {skus.map(s => (
                      <span key={s} className="inline-flex items-center gap-1 rounded-full bg-adm-chip px-2 py-0.5 font-admin-mono text-xs font-semibold">
                        {s}
                        <button type="button" onClick={() => setSkus(skus.filter(x => x !== s))} aria-label={`Quitar ${s}`} className="text-adm-muted hover:text-adm-ink">
                          <X className="size-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    {skus.length < MAX_SKUS && (
                      <input
                        id="wa-sku"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); addSkus(draft) }
                          if (e.key === 'Backspace' && !draft && skus.length) setSkus(skus.slice(0, -1))
                        }}
                        onPaste={e => { e.preventDefault(); addSkus(e.clipboardData.getData('text')) }}
                        onBlur={() => { if (draft.trim()) addSkus(draft) }}
                        disabled={isPending}
                        placeholder={skus.length ? '' : 'Ej. plan-pro-anual'}
                        className="min-w-28 flex-1 bg-transparent px-1 font-admin-mono text-sm outline-none!"
                      />
                    )}
                  </div>
                  <p className={field.hint}>El mismo «ID de contenido» que tiene cada producto en Meta. Hasta {MAX_SKUS}; uno solo se manda con foto grande.</p>
                </div>
              )}

              {needsHeader && (
                <label className="block">
                  <span className={field.label}>Título de la lista</span>
                  <input value={header} onChange={e => setHeader(e.target.value)} maxLength={60} disabled={isPending} placeholder="Ej. Planes para tu gimnasio" className={field.input} />
                </label>
              )}

              <label className="block">
                <span className={field.label}>Texto</span>
                <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={1024} rows={3} disabled={isPending} className={field.textarea} />
              </label>

              {needsCatalogId && (
                <p className="rounded-lg bg-adm-warn-bg px-3 py-2 text-[13px] text-adm-warn-fg">
                  Para mandar productos sueltos falta el ID del catálogo.{' '}
                  <button type="button" onClick={() => setSetup(true)} className="font-semibold underline underline-offset-2">Cargarlo</button>
                </p>
              )}
              {error && <p role="alert" className={field.error}>{error}</p>}
              <div className="flex items-center gap-2">
                <button type="button" onClick={send} disabled={isPending || needsCatalogId} className={btn.primary}>
                  {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                  Enviar
                </button>
                <button type="button" onClick={() => setSetup(true)} className={cn(btn.line, 'ml-auto')}>
                  <Settings2 className="size-3.5" aria-hidden="true" /> Ajustes del catálogo
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className={field.label}>Así llega</p>
              <Preview kind={kind} body={body} header={header} skus={skus} />
              <p className="text-xs text-adm-muted">WhatsApp completa la foto, el nombre y el precio desde tu catálogo en Meta.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
