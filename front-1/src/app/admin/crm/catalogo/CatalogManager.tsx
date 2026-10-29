'use client'

import { useRef, useState, useTransition } from 'react'
import { ImagePlus, Loader2, Package, Pencil, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { textError } from '@/lib/text-rules'
import { EmptyState, Switch, btn, field } from '@/components/admin/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  deleteProductAction, removeProductPhotoAction, saveProductAction, uploadProductPhotoAction, type CrmProduct,
} from '../actions'
import { CURRENCIES, fitJpeg, fmtPrice, productCaption } from '../catalog'

type Draft = { name: string; description: string; price: string; currency: string; active: boolean }

const EMPTY: Draft = { name: '', description: '', price: '', currency: 'USD', active: true }

/** Add or edit one product, its photo included */
function ProductDialog({
  product,
  open,
  onOpenChange,
  onSaved,
}: {
  /** null: new product */
  product: CrmProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (p: CrmProduct) => void
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    product
      ? { name: product.name, description: product.description ?? '', price: product.price === null ? '' : String(product.price), currency: product.currency, active: product.active }
      : EMPTY,
  )
  // undefined: keep; null: remove; Blob: new photo
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const shown = photo === undefined ? product?.imageUrl ?? null : photo?.preview ?? null
  const price = draft.price.trim() === '' ? null : Number(draft.price.replace(',', '.'))

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Elegí una imagen'); return }
    try {
      const blob = await fitJpeg(f)
      if (photo) URL.revokeObjectURL(photo.preview)
      setPhoto({ blob, preview: URL.createObjectURL(blob) })
      setError(null)
    } catch {
      setError('No se pudo leer la imagen')
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) { setError('Poné un nombre'); return }
    const bad = textError('name', draft.name)
    if (bad) { setError(`Nombre: ${bad}`); return }
    if (price !== null && (!Number.isFinite(price) || price < 0)) { setError('Precio inválido'); return }
    setError(null)
    startTransition(async () => {
      const saved = await saveProductAction(product?.id ?? null, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        price,
        currency: draft.currency,
        active: draft.active,
      })
      if ('error' in saved) { setError(saved.error); return }
      let imageUrl = saved.imageUrl
      if (photo) {
        const fd = new FormData()
        fd.append('photo', photo.blob, 'producto.jpg')
        const up = await uploadProductPhotoAction(saved.id, fd)
        if ('error' in up) { setError(`Se guardó, pero la foto no: ${up.error}`); onSaved(saved); return }
        imageUrl = up.imageUrl
      } else if (photo === null && product?.imageUrl) {
        await removeProductPhotoAction(saved.id)
        imageUrl = null
      }
      onSaved({ ...saved, imageUrl })
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-surface max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          <DialogDescription>Se manda al chat como foto, con el nombre, la descripción y el precio abajo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isPending}
              aria-label={shown ? 'Cambiar foto' : 'Agregar foto'}
              className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-adm-line bg-adm-subtle text-adm-muted transition-colors hover:border-adm-ink"
            >
              {shown
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={shown} alt="" className="size-full object-cover" />
                : <span className="flex flex-col items-center gap-1.5 text-xs font-semibold"><ImagePlus className="size-6" aria-hidden="true" />Agregar foto</span>}
            </button>
            {shown && (
              <button type="button" onClick={() => setPhoto(null)} disabled={isPending} className={cn(btn.link, 'self-start text-adm-bad-fg')}>
                <X className="size-3.5" aria-hidden="true" /> Quitar foto
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="sr-only" tabIndex={-1} aria-hidden="true" />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <label className="block">
              <span className={field.label}>Nombre</span>
              <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} maxLength={100} autoFocus disabled={isPending} placeholder="Ej. Plan Pro anual" className={field.input} />
            </label>
            <label className="block">
              <span className={field.label}>Descripción</span>
              <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} maxLength={900} rows={4} disabled={isPending} placeholder="Qué incluye, para quién es…" className={field.textarea} />
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
              <label className="block">
                <span className={field.label}>Precio</span>
                <input inputMode="decimal" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} disabled={isPending} placeholder="Vacío = a consultar" className={field.input} />
              </label>
              <label className="block">
                <span className={field.label}>Moneda</span>
                <select value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value })} disabled={isPending} className={field.input}>
                  {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>
                Disponible para enviar
                <span className="block text-xs font-normal text-adm-muted">Si lo apagás, no aparece en el chat</span>
              </span>
              <Switch checked={draft.active} onChange={active => setDraft({ ...draft, active })} disabled={isPending} label="Disponible para enviar" />
            </label>
            {draft.name.trim() && (
              <p className="whitespace-pre-wrap rounded-xl rounded-br-md bg-adm-ink px-3.5 py-2.5 text-sm leading-relaxed text-adm-surface">
                {productCaption({ name: draft.name.trim(), description: draft.description.trim() || null, price: Number.isFinite(price) ? price : null, currency: draft.currency })}
              </p>
            )}
            {error && <p role="alert" className={field.error}>{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => onOpenChange(false)} disabled={isPending} className={btn.line}>Cancelar</button>
              <button type="submit" disabled={isPending} className={btn.primary}>
                {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Guardar
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Grid of products: add, edit, turn on/off, delete */
export function CatalogManager({ initial }: { initial: CrmProduct[] }) {
  const [products, setProducts] = useState(initial)
  // undefined: closed; null: new; product: editing
  const [editing, setEditing] = useState<CrmProduct | null | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function upsert(p: CrmProduct) {
    setProducts(ps => (ps.some(x => x.id === p.id) ? ps.map(x => (x.id === p.id ? p : x)) : [...ps, p]))
  }

  function toggle(p: CrmProduct, active: boolean) {
    upsert({ ...p, active })
    startTransition(async () => {
      const res = await saveProductAction(p.id, { active })
      if ('error' in res) { upsert(p); setError(res.error) }
    })
  }

  function remove(p: CrmProduct) {
    if (confirmDelete !== p.id) { setConfirmDelete(p.id); return }
    startTransition(async () => {
      const res = await deleteProductAction(p.id)
      if (res.error) { setError(res.error); return }
      setProducts(ps => ps.filter(x => x.id !== p.id))
      setConfirmDelete(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-adm-muted">{products.length} {products.length === 1 ? 'producto' : 'productos'} · {products.filter(p => p.active).length} disponibles en el chat</p>
        <button type="button" onClick={() => setEditing(null)} className={btn.primary}>
          <Plus className="size-4" aria-hidden="true" /> Nuevo producto
        </button>
      </div>
      {error && <p role="alert" className={field.error}>{error}</p>}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-adm-line bg-adm-surface">
          <EmptyState icon={<Package className="size-9" />}>
            Cargá lo que le ofrecés a los gimnasios (planes, servicios, equipamiento…) para mandarlo desde el chat con foto y precio.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map(p => (
            <li key={p.id} className={cn('flex flex-col overflow-hidden rounded-2xl border border-adm-line bg-adm-surface', !p.active && 'opacity-60')}>
              <div className="flex aspect-[4/3] items-center justify-center bg-adm-subtle text-adm-muted">
                {p.imageUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                  : <Package className="size-8 opacity-40" aria-hidden="true" />}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                <p className="font-bold leading-snug">{p.name}</p>
                <p className="font-admin-mono text-sm font-semibold">{fmtPrice(p)}</p>
                {p.description && <p className="line-clamp-2 text-[13px] text-adm-muted">{p.description}</p>}
                <div className="mt-auto flex items-center gap-1 pt-2">
                  <Switch checked={p.active} onChange={a => toggle(p, a)} disabled={isPending} label={`${p.name} disponible para enviar`} />
                  <span className="ml-1.5 text-xs text-adm-muted">{p.active ? 'Disponible' : 'Oculto'}</span>
                  <span className="flex-1" />
                  <button type="button" onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`} className={btn.icon}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    disabled={isPending}
                    aria-label={confirmDelete === p.id ? `Confirmar: eliminar ${p.name}` : `Eliminar ${p.name}`}
                    className={cn(confirmDelete === p.id ? btn.dangerSolid : cn(btn.icon, 'hover:bg-adm-bad-bg hover:text-adm-bad-fg'))}
                  >
                    {confirmDelete === p.id ? '¿Eliminar?' : <Trash2 className="size-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== undefined && (
        <ProductDialog
          key={editing?.id ?? 'new'}
          product={editing}
          open
          onOpenChange={o => { if (!o) setEditing(undefined) }}
          onSaved={upsert}
        />
      )}
    </div>
  )
}
