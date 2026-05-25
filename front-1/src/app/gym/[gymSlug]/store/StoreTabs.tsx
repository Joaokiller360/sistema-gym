'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Package, BarChart2, Calendar, Plus, Minus, Trash2, Edit2, Tag, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { createSaleAction, createProductAction, updateProductAction, deleteProductAction, deleteSaleAction, createCategoryAction, updateCategoryAction, deleteCategoryAction, assignCreditsAction, payCreditsAction } from './actions'
import { createHandlers, type FieldType, inferFieldType } from '@/lib/input-validation'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Category {
  id: string
  name: string
  imageUrl: string | null
}

interface Member {
  id: string
  firstName: string
  lastName: string
  email: string
}


interface Product {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  cost: number | null
  stock: number
  categoryId: string | null
  category: Category | null
  isActive: boolean
  _count: { saleItems: number }
}

interface SaleItem {
  productId: string
  quantity: number
  unitPrice: number
  product: { name: string }
}

interface Sale {
  id: string
  total: number
  method: string
  notes: string | null
  createdAt: string
  items: SaleItem[]
}

interface CreditPeriodItem {
  id: string
  memberId: string
  member: { firstName: string; lastName: string }
  productId: string
  quantity: number
  unitPrice: number
  notes: string | null
  createdAt: string
  product: { name: string }
}

interface CutSummary {
  salesCount: number
  total: number
  byMethod: { method: string; count: number; total: number }[]
  byProduct: { name: string; quantity: number; total: number }[]
  sales: Sale[]
  credits: {
    count: number
    total: number
    byMember: { memberName: string; count: number; total: number }[]
    items: CreditPeriodItem[]
  }
}

interface PendingCredit {
  id: string
  memberId: string
  member: { firstName: string; lastName: string }
  productId: string
  quantity: number
  unitPrice: number
  notes: string | null
  createdAt: string
  product: { name: string }
}

interface Props {
  gymSlug: string
  products: Product[]
  categories: Category[]
  dailyCut: CutSummary | null
  monthlyCut: CutSummary | null
  activeTab: string
  dateParam: string
  monthParam: string
  members: Member[]
  pendingCredits: PendingCredit[]
  canDelete?: boolean
  canDeleteSales?: boolean
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', OTHER: 'Otro',
}

const TABS = [
  { id: 'sell', label: 'Vender', icon: ShoppingCart },
  { id: 'credits', label: 'Créditos', icon: CreditCard },
  { id: 'products', label: 'Productos', icon: Package },
  { id: 'categories', label: 'Categorías', icon: Tag },
  { id: 'daily', label: 'Corte del día', icon: Calendar },
  { id: 'monthly', label: 'Corte del mes', icon: BarChart2 },
] as const

type CartItem = { product: Product; quantity: number }

export function StoreTabs({ gymSlug, products, categories, dailyCut, monthlyCut, activeTab, dateParam, monthParam, members, pendingCredits, canDelete = false, canDeleteSales = false }: Props) {
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

      {tab === 'sell' && <SellTab gymSlug={gymSlug} products={products.filter(p => p.isActive && p.stock > 0)} members={members} />}
      {tab === 'credits' && <CreditsTab gymSlug={gymSlug} pendingCredits={pendingCredits} />}
      {tab === 'products' && <ProductsTab gymSlug={gymSlug} products={products} categories={categories} canDelete={canDelete} />}
      {tab === 'categories' && <CategoriesTab gymSlug={gymSlug} categories={categories} canDelete={canDelete} />}
      {tab === 'daily' && <CutTab cut={dailyCut} type="daily" dateParam={dateParam} gymSlug={gymSlug} canDelete={canDeleteSales} />}
      {tab === 'monthly' && <CutTab cut={monthlyCut} type="monthly" monthParam={monthParam} gymSlug={gymSlug} canDelete={canDeleteSales} />}
    </div>
  )
}

// ── Sell Tab ────────────────────────────────────────────────
function SellTab({ gymSlug, products, members }: { gymSlug: string; products: Product[]; members: Member[] }) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [mode, setMode] = useState<'sell' | 'fiado'>('sell')
  const [method, setMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [memberId, setMemberId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
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

  const filteredMembers = memberSearch && !memberId
    ? members.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearch.toLowerCase())
      ).slice(0, 8)
    : []

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

  function confirmAssign() {
    startTransition(async () => {
      const result = await assignCreditsAction(gymSlug, {
        memberId,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        notes: notes.trim() || undefined,
      })
      setShowConfirm(false)
      if (result.error) { toast.error(result.error); return }
      toast.success('Crédito asignado')
      setCart([])
      setNotes('')
      setMemberId('')
      setMemberSearch('')
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
        {products.map(p => {
          const inCart = cart.find(i => i.product.id === p.id)
          const lowStock = p.stock <= 3
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => addToCart(p)}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white text-left transition-all duration-300 hover:-translate-y-1 hover:border-[#1fad9d]/40 hover:shadow-xl active:scale-[0.98]"
            >
              {/* Image / Placeholder */}
              <div className="relative h-auto w-full overflow-hidden bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-200 shrink-0">
                {p.imageUrl ? (
                  <>
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-[#1fad9d]/0 transition-all duration-300 group-hover:bg-[#1fad9d]/10" />
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-[#1fad9d]/0 transition-all duration-300 group-hover:bg-[#1fad9d]/10" />
                    <div className="flex h-full items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/80 shadow-sm backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                        <Package className="h-8 w-8 text-[#1fad9d]" />
                      </div>
                    </div>
                  </>
                )}
                {/* + / cart qty badge */}
                {inCart ? (
                  <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#1fad9d] text-white shadow-md font-black text-sm">
                    {inCart.quantity}
                  </div>
                ) : (
                  <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1fad9d] shadow-md backdrop-blur transition-all duration-300 group-hover:scale-110 group-hover:bg-[#1fad9d] group-hover:text-white font-black text-lg leading-none">
                    +
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="space-y-1">
                  <h3 className="line-clamp-1 text-sm font-extrabold tracking-tight text-zinc-800">{p.name}</h3>
                  {p.category && (
                    <span className="inline-flex items-center rounded-full bg-[#1fad9d]/10 px-2.5 py-1 text-[11px] font-semibold text-[#1fad9d]">
                      {p.category.name}
                    </span>
                  )}
                </div>
                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-zinc-400">Precio</p>
                    <p className="text-xl font-black tracking-tight text-[#1fad9d]">${p.price.toLocaleString('es-AR')}</p>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    lowStock
                      ? 'border border-amber-100 bg-amber-50 text-amber-600'
                      : 'border border-emerald-100 bg-emerald-50 text-emerald-600'
                  }`}>
                    <span className={`h-2 w-2 rounded-full animate-pulse ${lowStock ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    {p.stock} stock
                  </div>
                </div>
              </div>

              {/* Shimmer sweep on hover */}
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                <div className="absolute -left-1/2 top-0 h-full w-1/3 rotate-12 bg-white/20 blur-2xl transition-all duration-700 group-hover:left-[120%]" />
              </div>
            </button>
          )
        })}
      </div>

      {/* Cart */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 h-fit">
        {/* Mode toggle */}
        <div className="flex gap-1 border rounded-xl p-1 bg-zinc-50">
          <button
            type="button"
            onClick={() => setMode('sell')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'sell' ? 'bg-black text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
          >
            Cobrar
          </button>
          <button
            type="button"
            onClick={() => setMode('fiado')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'fiado' ? 'bg-amber-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
          >
            Fiado
          </button>
        </div>

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

        {mode === 'sell' ? (
          <>
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
              {...createHandlers('text')}
            />
            <button
              type="button"
              disabled={!cart.length || isPending}
              onClick={handleSell}
              className="w-full rounded-xl bg-[#1fad9d] py-3 text-sm font-black text-white hover:bg-[#0e7a70] disabled:opacity-40 transition-all active:scale-[0.98]"
            >
              {isPending ? 'Procesando…' : `Cobrar $${total.toLocaleString('es-AR')}`}
            </button>
          </>
        ) : (
          <>
            <div className="space-y-1 relative">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Miembro</p>
              <input
                type="text"
                placeholder="Buscar miembro..."
                value={memberSearch}
                onChange={e => { setMemberSearch(e.target.value); setMemberId('') }}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                {...createHandlers('search')}
              />
              {filteredMembers.length > 0 && (
                <div className="absolute z-10 w-full rounded-xl border border-zinc-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                  {filteredMembers.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setMemberId(m.id); setMemberSearch(`${m.firstName} ${m.lastName}`) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
                    >
                      <p className="font-semibold">{m.firstName} {m.lastName}</p>
                      <p className="text-xs text-zinc-400">{m.email}</p>
                    </button>
                  ))}
                </div>
              )}
              {memberId && <p className="text-xs text-amber-600 font-semibold">✓ {memberSearch}</p>}
            </div>
            <input
              type="text"
              placeholder="Notas (opcional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="button"
              disabled={!memberId || !cart.length || isPending}
              onClick={() => setShowConfirm(true)}
              className="w-full rounded-xl bg-amber-500 py-3 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-40 transition-all active:scale-[0.98]"
            >
              {isPending ? 'Asignando…' : `Asignar fiado $${total.toLocaleString('es-AR')}`}
            </button>
          </>
        )}
      </div>

      <AlertDialog open={showConfirm} onOpenChange={open => { if (!open) setShowConfirm(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar fiado</AlertDialogTitle>
            <AlertDialogDescription>
              {memberSearch} — deuda pendiente, no se cobra ahora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2 space-y-1.5">
            {cart.map(({ product, quantity }) => (
              <div key={product.id} className="flex justify-between text-sm">
                <span className="text-zinc-700">{product.name} <span className="text-zinc-400">×{quantity}</span></span>
                <span className="font-semibold">${(product.price * quantity).toLocaleString('es-AR')}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-black border-t pt-2">
              <span>Total deuda</span>
              <span className="text-amber-600">${total.toLocaleString('es-AR')}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <button onClick={confirmAssign} disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-all"
            >
              {isPending ? 'Asignando…' : 'Confirmar fiado'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Products Tab ────────────────────────────────────────────
function ProductsTab({ gymSlug, products, categories, canDelete }: { gymSlug: string; products: Product[]; categories: Category[]; canDelete: boolean }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSaved() {
    setModalOpen(false)
    setEditProduct(null)
    router.refresh()
  }

  function closeModal() {
    setModalOpen(false)
    setEditProduct(null)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteProductAction(gymSlug, deleteTarget.id)
      setDeleteTarget(null)
      if (result.error) { toast.error(result.error); return }
      toast.success('Producto eliminado')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{products.length} producto{products.length !== 1 ? 's' : ''}</p>
        <button
          type="button"
          onClick={() => { setEditProduct(null); setModalOpen(true) }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-all"
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </button>
      </div>

      <Dialog open={modalOpen} onOpenChange={open => { if (!open) closeModal() }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editProduct ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          </DialogHeader>
          <ProductForm
            gymSlug={gymSlug}
            product={editProduct}
            categories={categories}
            onSave={handleSaved}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>

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
                    <div className="flex items-center gap-3">
                      {p.imageUrl && (
                        <img src={p.imageUrl} alt={p.name} className="h-9 w-9 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold">{p.name}</p>
                        {p.description && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{p.description}</p>}
                        {!p.isActive && <span className="text-xs text-zinc-400 font-medium">(inactivo)</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground hidden sm:table-cell">{p.category?.name ?? '—'}</td>
                  <td className="px-5 py-4 font-bold">${p.price.toLocaleString('es-AR')}</td>
                  <td className="px-5 py-4">
                    <span className={`font-bold ${p.stock === 0 ? 'text-red-500' : p.stock <= 3 ? 'text-amber-500' : 'text-zinc-700'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground hidden md:table-cell">{p._count.saleItems}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => { setEditProduct(p); setModalOpen(true) }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; será eliminado permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <button
              onClick={confirmDelete}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-all"
            >
              {isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Product Form ────────────────────────────────────────────
function ProductForm({ gymSlug, product, categories, onSave, onCancel }: {
  gymSlug: string
  product: Product | null
  categories: Category[]
  onSave: () => void
  onCancel: () => void
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
      imageUrl: fd.get('imageUrl') as string,
      price: parseFloat(fd.get('price') as string),
      cost: fd.get('cost') ? parseFloat(fd.get('cost') as string) : undefined,
      stock: parseInt(fd.get('stock') as string, 10),
      categoryId: fd.get('categoryId') as string,
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
    <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Nombre *" name="name" defaultValue={product?.name} placeholder="Proteína whey" />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600">Categoría</label>
            <select
              name="categoryId"
              defaultValue={product?.categoryId ?? ''}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
            >
              <option value="">Sin categoría</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <FormField label="Descripción" name="description" defaultValue={product?.description ?? ''} placeholder="Descripción opcional" fieldType="text" />
        <FormField label="URL de imagen" name="imageUrl" defaultValue={product?.imageUrl ?? ''} placeholder="https://..." fieldType="url" />
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Precio *" name="price" type="number" defaultValue={String(product?.price ?? '')} placeholder="500" min="0.01" step="0.01" />
          <FormField label="Costo" name="cost" type="number" defaultValue={String(product?.cost ?? '')} placeholder="300" min="0" step="0.01" />
          <FormField label="Stock *" name="stock" type="number" defaultValue={String(product?.stock ?? '0')} placeholder="10" min="0" step="1" />
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
  )
}

function FormField({ label, name, type = 'text', defaultValue, placeholder, min, step, fieldType }: {
  label: string; name: string; type?: string; defaultValue?: string; placeholder?: string; min?: string; step?: string; fieldType?: FieldType
}) {
  const effectiveFieldType: FieldType = fieldType ?? inferFieldType(type)
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-zinc-600">{label}</label>
      <input
        name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} min={min} step={step}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
        {...createHandlers(effectiveFieldType)}
      />
    </div>
  )
}

// ── Categories Tab ──────────────────────────────────────────
function CategoriesTab({ gymSlug, categories, canDelete }: { gymSlug: string; categories: Category[]; canDelete: boolean }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSaved() {
    setModalOpen(false)
    setEditCategory(null)
    router.refresh()
  }

  function closeModal() {
    setModalOpen(false)
    setEditCategory(null)
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCategoryAction(gymSlug, id)
      if (result.error) { toast.error(result.error); return }
      toast.success('Categoría eliminada')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{categories.length} categoría{categories.length !== 1 ? 's' : ''}</p>
        <button
          type="button"
          onClick={() => { setEditCategory(null); setModalOpen(true) }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-all"
        >
          <Plus className="h-4 w-4" />
          Nueva categoría
        </button>
      </div>

      <Dialog open={modalOpen} onOpenChange={open => { if (!open) closeModal() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editCategory ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <CategoryForm
            gymSlug={gymSlug}
            category={editCategory}
            onSave={handleSaved}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-sm text-muted-foreground">
          No hay categorías creadas
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
              {c.imageUrl ? (
                <img src={c.imageUrl} alt={c.name} className="h-10 w-10 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                  <Tag className="h-4 w-4 text-zinc-400" />
                </div>
              )}
              <p className="font-semibold text-sm flex-1 truncate">{c.name}</p>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => { setEditCategory(c); setModalOpen(true) }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                {canDelete && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(c.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Category Form ───────────────────────────────────────────
function CategoryForm({ gymSlug, category, onSave, onCancel }: {
  gymSlug: string
  category: Category | null
  onSave: () => void
  onCancel: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const data = {
      name: fd.get('name') as string,
      imageUrl: fd.get('imageUrl') as string,
    }

    startTransition(async () => {
      const result = category
        ? await updateCategoryAction(gymSlug, category.id, data)
        : await createCategoryAction(gymSlug, data)

      if (result.error) { setError(result.error); return }
      toast.success(category ? 'Categoría actualizada' : 'Categoría creada')
      onSave()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Nombre *" name="name" defaultValue={category?.name} placeholder="Suplementos" />
        <FormField label="URL de imagen" name="imageUrl" defaultValue={category?.imageUrl ?? ''} placeholder="https://..." fieldType="url" />
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
  )
}

// ── Credits Tab ─────────────────────────────────────────────
function CreditsTab({ gymSlug, pendingCredits }: {
  gymSlug: string
  pendingCredits: PendingCredit[]
}) {
  const byMemberAll = pendingCredits.reduce<Record<string, { member: PendingCredit['member']; memberId: string; items: PendingCredit[] }>>((acc, c) => {
    if (!acc[c.memberId]) acc[c.memberId] = { member: c.member, memberId: c.memberId, items: [] }
    acc[c.memberId].items.push(c)
    return acc
  }, {})

  return <AllCreditsView gymSlug={gymSlug} byMember={Object.values(byMemberAll)} />
}

function AllCreditsView({ gymSlug, byMember }: {
  gymSlug: string
  byMember: { member: PendingCredit['member']; memberId: string; items: PendingCredit[] }[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [payTarget, setPayTarget] = useState<{ creditIds: string[]; memberName: string; total: number; memberId: string } | null>(null)
  const [payMethod, setPayMethod] = useState('CASH')
  const [isPending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const filtered = search
    ? byMember.filter(g => `${g.member.firstName} ${g.member.lastName}`.toLowerCase().includes(search.toLowerCase()))
    : byMember

  const grandTotal = byMember.reduce((s, g) => s + g.items.reduce((a, c) => a + c.unitPrice * c.quantity, 0), 0)

  function confirmPay() {
    if (!payTarget) return
    startTransition(async () => {
      const result = await payCreditsAction(gymSlug, payTarget.creditIds, payMethod, payTarget.memberId)
      setPayTarget(null)
      if (result.error) { toast.error(result.error); return }
      toast.success('Créditos cobrados')
      router.refresh()
    })
  }

  if (byMember.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-sm text-muted-foreground">
        No hay créditos pendientes
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Buscar miembro..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d] w-64"
          {...createHandlers('search')}
        />
        <p className="text-sm text-muted-foreground ml-auto">{filtered.length} miembro{filtered.length !== 1 ? 's' : ''} · Total: <span className="font-black text-[#1fad9d]">${grandTotal.toLocaleString('es-AR')}</span></p>
      </div>

      {filtered.map(({ member, memberId, items }) => {
        const memberTotal = items.reduce((s, c) => s + c.unitPrice * c.quantity, 0)
        const isOpen = expanded[memberId]
        return (
          <div key={memberId} className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <button
                type="button"
                onClick={() => setExpanded(prev => ({ ...prev, [memberId]: !isOpen }))}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-zinc-400">{items.length} producto{items.length !== 1 ? 's' : ''} pendiente{items.length !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-xs text-zinc-400 ml-auto mr-3">{isOpen ? '▲' : '▼'}</span>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <p className="font-black text-[#1fad9d]">${memberTotal.toLocaleString('es-AR')}</p>
                <button
                  type="button"
                  onClick={() => setPayTarget({ creditIds: items.map(c => c.id), memberName: `${member.firstName} ${member.lastName}`, total: memberTotal, memberId })}
                  className="rounded-xl bg-[#1fad9d] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0e7a70] transition-all"
                >
                  Cobrar
                </button>
              </div>
            </div>
            {isOpen && (
              <div className="divide-y divide-zinc-100 border-t border-zinc-200">
                {items.map(credit => (
                  <div key={credit.id} className="px-5 py-3 flex items-start justify-between gap-3 bg-zinc-50/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{credit.product.name}</span>
                        <span className="text-xs text-zinc-400">×{credit.quantity}</span>
                        <span className="font-bold text-sm text-[#1fad9d]">${(credit.unitPrice * credit.quantity).toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-zinc-400">{new Date(credit.createdAt).toLocaleDateString('es-AR')}</span>
                        {credit.notes && <span className="text-xs text-zinc-400 italic">— {credit.notes}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPayTarget({ creditIds: [credit.id], memberName: `${member.firstName} ${member.lastName}`, total: credit.unitPrice * credit.quantity, memberId })}
                      className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:border-[#1fad9d] hover:text-[#1fad9d] transition-all shrink-0"
                    >
                      Cobrar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <AlertDialog open={!!payTarget} onOpenChange={open => { if (!open) setPayTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cobrar fiado</AlertDialogTitle>
            <AlertDialogDescription>
              {payTarget?.memberName} — ${payTarget?.total.toLocaleString('es-AR')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Método de pago</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(METHOD_LABELS).map(([v, label]) => (
                <button key={v} type="button" onClick={() => setPayMethod(v)}
                  className={`rounded-lg border py-2 text-xs font-semibold transition-all ${payMethod === v ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}
                >{label}</button>
              ))}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <button onClick={confirmPay} disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl bg-[#1fad9d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e7a70] disabled:opacity-50 transition-all"
            >
              {isPending ? 'Procesando…' : `Cobrar $${payTarget?.total.toLocaleString('es-AR')}`}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Cut Tab ─────────────────────────────────────────────────
function CutTab({ cut, type, dateParam, monthParam, gymSlug, canDelete }: {
  cut: CutSummary | null; type: 'daily' | 'monthly'; dateParam?: string; monthParam?: string; gymSlug: string; canDelete: boolean
}) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null)
  const [isPending, startTransition] = useTransition()

  function confirmDeleteSale() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteSaleAction(gymSlug, deleteTarget.id)
      setDeleteTarget(null)
      if (result.error) { toast.error(result.error); return }
      toast.success('Venta eliminada y stock restaurado')
      router.refresh()
    })
  }

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

      {/* Individual sales */}
      {(cut?.sales.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
          <p className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-zinc-400 bg-zinc-50 border-b border-zinc-200">Detalle de ventas</p>
          <div className="divide-y divide-zinc-100">
            {cut!.sales.map(sale => (
              <div key={sale.id} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-zinc-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">${sale.total.toLocaleString('es-AR')}</span>
                    <span className="text-xs text-zinc-400">{METHOD_LABELS[sale.method] ?? sale.method}</span>
                    <span className="text-xs text-zinc-400">{new Date(sale.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {sale.items.map(i => `${i.product.name} ×${i.quantity}`).join(', ')}
                  </p>
                  {sale.notes && <p className="text-xs text-zinc-400 italic mt-0.5">{sale.notes}</p>}
                </div>
                {canDelete && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setDeleteTarget(sale)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {cut?.salesCount === 0 && (cut?.credits?.count ?? 0) === 0 && (
        <div className="flex items-center justify-center rounded-2xl border border-dashed py-16 text-sm text-muted-foreground">
          Sin movimientos en este período
        </div>
      )}

      {/* Credits in period */}
      {(cut?.credits?.count ?? 0) > 0 && (
        <div className="rounded-2xl border border-amber-200 overflow-hidden bg-amber-50/40">
          <div className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-200">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Ventas fiadas del período</p>
            <p className="font-black text-amber-700">${(cut!.credits.total).toLocaleString('es-AR')}</p>
          </div>
          <div className="px-5 py-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-amber-600 font-semibold">Asignaciones</p>
              <p className="text-2xl font-black text-amber-800">{cut!.credits.count}</p>
            </div>
            <div>
              <p className="text-xs text-amber-600 font-semibold">Miembros</p>
              <p className="text-2xl font-black text-amber-800">{cut!.credits.byMember.length}</p>
            </div>
          </div>
          {cut!.credits.byMember.length > 0 && (
            <div className="border-t border-amber-200">
              {cut!.credits.byMember.map((m, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-2.5 border-b border-amber-100 last:border-0">
                  <span className="text-sm font-semibold text-amber-900">{m.memberName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-amber-600">{m.count} ítem{m.count !== 1 ? 's' : ''}</span>
                    <span className="font-bold text-amber-800">${m.total.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la venta de ${deleteTarget?.total.toLocaleString('es-AR')} y se restaurará el stock de los productos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <button
              onClick={confirmDeleteSale}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-all"
            >
              {isPending ? 'Anulando…' : 'Anular venta'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
