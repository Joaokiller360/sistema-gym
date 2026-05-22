'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Package, BarChart2, Calendar, Plus, Minus, Trash2, CheckCircle2, Edit2 } from 'lucide-react'
import { toast } from 'sonner'
import { createSaleAction, createProductAction, updateProductAction, deleteProductAction } from './actions'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  cost: number | null
  stock: number
  category: string | null
  isActive: boolean
  _count: { saleItems: number }
}

interface CutSummary {
  salesCount: number
  total: number
  byMethod: { method: string; count: number; total: number }[]
  byProduct: { name: string; quantity: number; total: number }[]
}

interface Props {
  gymSlug: string
  products: Product[]
  dailyCut: CutSummary | null
  monthlyCut: CutSummary | null
  activeTab: string
  dateParam: string
  monthParam: string
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', OTHER: 'Otro',
}

const TABS = [
  { id: 'sell', label: 'Vender', icon: ShoppingCart },
  { id: 'products', label: 'Productos', icon: Package },
  { id: 'daily', label: 'Corte del día', icon: Calendar },
  { id: 'monthly', label: 'Corte del mes', icon: BarChart2 },
] as const

type CartItem = { product: Product; quantity: number }

export function StoreTabs({ gymSlug, products, dailyCut, monthlyCut, activeTab, dateParam, monthParam }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState(activeTab)

  function changeTab(t: string) {
    setTab(t)
    router.push(`?tab=${t}`)
  }

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border rounded-xl p-1 bg-zinc-50 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => changeTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === id ? 'bg-black text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === 'sell' && <SellTab gymSlug={gymSlug} products={products.filter(p => p.isActive && p.stock > 0)} />}
      {tab === 'products' && <ProductsTab gymSlug={gymSlug} products={products} />}
      {tab === 'daily' && <CutTab cut={dailyCut} type="daily" dateParam={dateParam} gymSlug={gymSlug} />}
      {tab === 'monthly' && <CutTab cut={monthlyCut} type="monthly" monthParam={monthParam} gymSlug={gymSlug} />}
    </div>
  )
}

// ── Sell Tab ────────────────────────────────────────────────
function SellTab({ gymSlug, products }: { gymSlug: string; products: Product[] }) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [method, setMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) return prev
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  function changeQty(productId: string, delta: number) {
    setCart(prev => prev
      .map(i => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0)
    )
  }

  const total = cart.reduce((s, i) => s + i.product.price * i.quantity, 0)

  function handleSell() {
    if (!cart.length) return
    startTransition(async () => {
      const result = await createSaleAction(gymSlug, {
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        method,
        notes: notes.trim() || undefined,
      })
      if (result.error) { toast.error(result.error); return }
      toast.success('Venta registrada')
      setCart([])
      setNotes('')
      router.refresh()
    })
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-sm text-muted-foreground gap-2">
        <Package className="h-10 w-10 opacity-20" />
        No hay productos disponibles en stock
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product grid */}
      <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {products.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => addToCart(p)}
            className="flex flex-col items-start gap-1 rounded-2xl border border-zinc-200 bg-white p-4 text-left hover:border-[#1fad9d] hover:shadow-sm transition-all active:scale-[0.98]"
          >
            <p className="font-bold text-sm truncate w-full">{p.name}</p>
            {p.category && <p className="text-xs text-zinc-400">{p.category}</p>}
            <p className="text-[#1fad9d] font-black text-base mt-1">${p.price.toLocaleString('es-AR')}</p>
            <p className="text-xs text-zinc-400">Stock: {p.stock}</p>
          </button>
        ))}
      </div>

      {/* Cart */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 h-fit">
        <p className="font-black text-sm uppercase tracking-widest text-zinc-400">Carrito</p>

        {cart.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Seleccioná productos</p>
        ) : (
          <div className="space-y-3">
            {cart.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{product.name}</p>
                  <p className="text-xs text-zinc-400">${product.price.toLocaleString('es-AR')} c/u</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => changeQty(product.id, -1)} className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => changeQty(product.id, 1)}
                    disabled={quantity >= product.stock}
                    className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-sm font-bold w-16 text-right">${(product.price * quantity).toLocaleString('es-AR')}</p>
              </div>
            ))}

            <div className="border-t pt-3 flex items-center justify-between">
              <span className="font-bold">Total</span>
              <span className="text-xl font-black text-[#1fad9d]">${total.toLocaleString('es-AR')}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Método de pago</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(METHOD_LABELS).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMethod(v)}
                className={`rounded-lg border py-2 text-xs font-semibold transition-all ${
                  method === v ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          placeholder="Notas (opcional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
        />

        <button
          type="button"
          disabled={!cart.length || isPending}
          onClick={handleSell}
          className="w-full rounded-xl bg-[#1fad9d] py-3 text-sm font-black text-white hover:bg-[#0e7a70] disabled:opacity-40 transition-all active:scale-[0.98]"
        >
          {isPending ? 'Procesando…' : `Cobrar $${total.toLocaleString('es-AR')}`}
        </button>
      </div>
    </div>
  )
}

// ── Products Tab ────────────────────────────────────────────
function ProductsTab({ gymSlug, products }: { gymSlug: string; products: Product[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)

  function handleSaved() {
    setShowForm(false)
    setEditProduct(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{products.length} producto{products.length !== 1 ? 's' : ''}</p>
        <button
          type="button"
          onClick={() => { setEditProduct(null); setShowForm(true) }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-all"
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </button>
      </div>

      {(showForm || editProduct) && (
        <ProductForm
          gymSlug={gymSlug}
          product={editProduct}
          onSave={handleSaved}
          onCancel={() => { setShowForm(false); setEditProduct(null) }}
        />
      )}

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-sm text-muted-foreground">
          No hay productos creados
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500">Producto</th>
                <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Categoría</th>
                <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500">Precio</th>
                <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500">Stock</th>
                <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden md:table-cell">Vendidos</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold">{p.name}</p>
                    {p.description && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{p.description}</p>}
                    {!p.isActive && <span className="text-xs text-zinc-400 font-medium">(inactivo)</span>}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground hidden sm:table-cell">{p.category ?? '—'}</td>
                  <td className="px-5 py-4 font-bold">${p.price.toLocaleString('es-AR')}</td>
                  <td className="px-5 py-4">
                    <span className={`font-bold ${p.stock === 0 ? 'text-red-500' : p.stock <= 3 ? 'text-amber-500' : 'text-zinc-700'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground hidden md:table-cell">{p._count.saleItems}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => { setEditProduct(p); setShowForm(false) }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Product Form ────────────────────────────────────────────
function ProductForm({ gymSlug, product, onSave, onCancel }: {
  gymSlug: string; product: Product | null; onSave: () => void; onCancel: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const data = {
      name: fd.get('name') as string,
      description: fd.get('description') as string,
      price: parseInt(fd.get('price') as string, 10),
      cost: fd.get('cost') ? parseInt(fd.get('cost') as string, 10) : undefined,
      stock: parseInt(fd.get('stock') as string, 10),
      category: fd.get('category') as string,
      isActive: fd.get('isActive') === 'true',
    }

    startTransition(async () => {
      const result = product
        ? await updateProductAction(gymSlug, product.id, data)
        : await createProductAction(gymSlug, data)

      if (result.error) { setError(result.error); return }
      toast.success(product ? 'Producto actualizado' : 'Producto creado')
      onSave()
    })
  }

  return (
    <div className="rounded-2xl border-2 border-[#1fad9d]/30 bg-[#1fad9d]/5 p-5">
      <p className="font-bold text-sm mb-4">{product ? 'Editar producto' : 'Nuevo producto'}</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Nombre *" name="name" defaultValue={product?.name} placeholder="Proteína whey" />
          <FormField label="Categoría" name="category" defaultValue={product?.category ?? ''} placeholder="Suplementos" />
        </div>
        <FormField label="Descripción" name="description" defaultValue={product?.description ?? ''} placeholder="Descripción opcional" />
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Precio *" name="price" type="number" defaultValue={String(product?.price ?? '')} placeholder="500" min="1" />
          <FormField label="Costo" name="cost" type="number" defaultValue={String(product?.cost ?? '')} placeholder="300" min="0" />
          <FormField label="Stock *" name="stock" type="number" defaultValue={String(product?.stock ?? '0')} placeholder="10" min="0" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold">Estado:</label>
          <select name="isActive" defaultValue={String(product?.isActive ?? true)} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm">
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending} className="rounded-xl bg-black px-5 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={onCancel} className="rounded-xl border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function FormField({ label, name, type = 'text', defaultValue, placeholder, min }: {
  label: string; name: string; type?: string; defaultValue?: string; placeholder?: string; min?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-zinc-600">{label}</label>
      <input
        name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} min={min}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
      />
    </div>
  )
}

// ── Cut Tab ─────────────────────────────────────────────────
function CutTab({ cut, type, dateParam, monthParam, gymSlug }: {
  cut: CutSummary | null; type: 'daily' | 'monthly'; dateParam?: string; monthParam?: string; gymSlug: string
}) {
  const router = useRouter()

  return (
    <div className="space-y-5">
      {/* Date/month picker */}
      <div className="flex items-center gap-3">
        {type === 'daily' ? (
          <input
            type="date"
            defaultValue={dateParam}
            onChange={e => router.push(`?tab=daily&date=${e.target.value}`)}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
          />
        ) : (
          <input
            type="month"
            defaultValue={monthParam}
            onChange={e => router.push(`?tab=monthly&month=${e.target.value}`)}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
          />
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[#1fad9d]/25 bg-[#1fad9d]/5 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#0e7a70] mb-1">Total</p>
          <p className="text-3xl font-black text-[#1fad9d]">${(cut?.total ?? 0).toLocaleString('es-AR')}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Ventas</p>
          <p className="text-3xl font-black">{cut?.salesCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 col-span-2 sm:col-span-1">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">Promedio</p>
          <p className="text-3xl font-black">
            ${cut?.salesCount ? Math.round((cut.total) / cut.salesCount).toLocaleString('es-AR') : 0}
          </p>
        </div>
      </div>

      {/* By method */}
      {(cut?.byMethod.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
          <p className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-zinc-400 bg-zinc-50 border-b border-zinc-200">Por método de pago</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100">
              {cut!.byMethod.map(m => (
                <tr key={m.method} className="hover:bg-zinc-50">
                  <td className="px-5 py-3 font-semibold">{METHOD_LABELS[m.method] ?? m.method}</td>
                  <td className="px-5 py-3 text-muted-foreground">{m.count} venta{m.count !== 1 ? 's' : ''}</td>
                  <td className="px-5 py-3 font-bold text-right">${m.total.toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* By product */}
      {(cut?.byProduct.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
          <p className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-zinc-400 bg-zinc-50 border-b border-zinc-200">Por producto</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="text-left px-5 py-3 font-semibold text-xs text-zinc-500">Producto</th>
                <th className="text-left px-5 py-3 font-semibold text-xs text-zinc-500">Unidades</th>
                <th className="text-right px-5 py-3 font-semibold text-xs text-zinc-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cut!.byProduct.map((p, i) => (
                <tr key={i} className="hover:bg-zinc-50">
                  <td className="px-5 py-3 font-semibold">{p.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.quantity}</td>
                  <td className="px-5 py-3 font-bold text-right">${p.total.toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cut?.salesCount === 0 && (
        <div className="flex items-center justify-center rounded-2xl border border-dashed py-16 text-sm text-muted-foreground">
          Sin ventas en este período
        </div>
      )}
    </div>
  )
}
