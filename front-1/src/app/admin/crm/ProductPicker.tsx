'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2, Package, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btn, field } from '@/components/admin/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listProductsAction, sendProductAction, type CrmProduct } from './actions'
import { fmtPrice, productCaption } from './catalog'

/** Pick a catalog product and send it into this chat: photo + name, description and price. */
export function ProductPicker({
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
  const [products, setProducts] = useState<CrmProduct[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Fetched on open: the catalog may have changed in another tab
  useEffect(() => {
    if (!open) return
    let live = true
    void listProductsAction().then(res => {
      if (!live) return
      if ('error' in res) { setError(res.error); setProducts([]) }
      else setProducts(res.filter(p => p.active))
    })
    return () => { live = false }
  }, [open])

  const product = products?.find(p => p.id === selected) ?? null

  function send() {
    if (!product) return
    setError(null)
    startTransition(async () => {
      const res = await sendProductAction(conversationId, product.id, replyToId)
      if (res.error) { setError(res.error); return }
      onOpenChange(false)
      setSelected(null)
      onSent()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-surface max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Enviar producto</DialogTitle>
          <DialogDescription>
            Va como foto con el nombre, la descripción y el precio. <Link href="/admin/crm/catalogo" className="font-semibold underline underline-offset-2">Editar catálogo</Link>
          </DialogDescription>
        </DialogHeader>
        {products === null ? (
          <div className="flex justify-center py-10 text-adm-muted"><Loader2 className="size-6 animate-spin" aria-label="Cargando" /></div>
        ) : products.length === 0 ? (
          <p className="py-6 text-sm text-adm-muted">
            {error ?? 'No hay productos disponibles.'} <Link href="/admin/crm/catalogo" className="font-semibold text-adm-ink underline underline-offset-2">Cargá el catálogo</Link>
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_260px]">
            <ul aria-label="Productos" className="grid max-h-[60dvh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {products.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={selected === p.id}
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      'flex w-full flex-col overflow-hidden rounded-xl border text-left transition-colors',
                      selected === p.id ? 'border-adm-ink ring-2 ring-adm-ink' : 'border-adm-line hover:border-adm-ink',
                    )}
                  >
                    <span className="flex aspect-square items-center justify-center bg-adm-subtle text-adm-muted">
                      {p.imageUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                        : <Package className="size-6 opacity-40" aria-hidden="true" />}
                    </span>
                    <span className="block p-2">
                      <span className="block truncate text-[13px] font-bold">{p.name}</span>
                      <span className="block font-admin-mono text-xs text-adm-muted">{fmtPrice(p)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3">
              {product ? (
                <>
                  <div className="overflow-hidden rounded-xl rounded-br-md bg-adm-ink text-sm leading-relaxed text-adm-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {product.imageUrl && <img src={product.imageUrl} alt="" className="max-h-56 w-full object-cover" />}
                    <p className="whitespace-pre-wrap px-3.5 py-2.5">{productCaption(product)}</p>
                  </div>
                  {!product.imageUrl && <p className="text-xs text-adm-muted">Sin foto: se manda solo el texto.</p>}
                  {error && <p role="alert" className={field.error}>{error}</p>}
                  <button type="button" onClick={send} disabled={isPending} className={btn.primary}>
                    {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                    Enviar
                  </button>
                </>
              ) : (
                <p className="self-center pt-8 text-sm text-adm-muted">Elegí un producto para ver cómo llega.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
