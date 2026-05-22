'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Minus, ShoppingBag, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { assignCreditsAction, payCreditsAction } from '../../store/actions'

interface Product {
  id: string
  name: string
  price: number
  stock: number
  category: string | null
  isActive: boolean
}

interface Credit {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  isPaid: boolean
  paidAt: string | null
  notes: string | null
  createdAt: string
  product: { name: string; price: number }
}

interface Props {
  gymSlug: string
  memberId: string
  products: Product[]
  credits: Credit[]
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', OTHER: 'Otro',
}

export function MemberCredits({ gymSlug, memberId, products, credits }: Props) {
  const router = useRouter()
  const activeProducts = products.filter(p => p.isActive)
  const pendingCredits = credits.filter(c => !c.isPaid)
  const paidCredits = credits.filter(c => c.isPaid)
  const pendingTotal = pendingCredits.reduce((s, c) => s + c.unitPrice * c.quantity, 0)

  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([])
  const [notes, setNotes] = useState('')
  const [payMethod, setPayMethod] = useState('CASH')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isPendingAssign, startAssign] = useTransition()
  const [isPendingPay, startPay] = useTransition()

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product, quantity: 1 }]
    })
  }

  function changeQty(productId: string, delta: number) {
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0))
  }

  function handleAssign() {
    if (!cart.length) return
    startAssign(async () => {
      const result = await assignCreditsAction(gymSlug, {
        memberId,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        notes: notes.trim() || undefined,
      })
      if (result.error) { toast.error(result.error); return }
      toast.success('Productos asignados como crédito')
      setCart([])
      setNotes('')
      router.refresh()
    })
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handlePay() {
    const ids = selectedIds.length ? selectedIds : pendingCredits.map(c => c.id)
    if (!ids.length) return
    startPay(async () => {
      const result = await payCreditsAction(gymSlug, ids, payMethod)
      if (result.error) { toast.error(result.error); return }
      toast.success('Créditos saldados')
      setSelectedIds([])
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Assign form */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
        <p className="font-black text-sm uppercase tracking-widest text-zinc-400">Asignar productos a crédito</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {activeProducts.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => addToCart(p)}
              className="flex flex-col items-start gap-1 rounded-xl border border-zinc-200 p-3 text-left hover:border-[#1fad9d] transition-all"
            >
              <p className="font-semibold text-xs truncate w-full">{p.name}</p>
              <p className="text-[#1fad9d] font-black text-sm">${p.price.toLocaleString('es-AR')}</p>
            </button>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            {cart.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center gap-2">
                <p className="flex-1 text-sm font-semibold">{product.name}</p>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => changeQty(product.id, -1)} className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm font-bold">{quantity}</span>
                  <button type="button" onClick={() => changeQty(product.id, 1)} className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-sm font-bold w-16 text-right">${(product.price * quantity).toLocaleString('es-AR')}</p>
              </div>
            ))}
            <input
              type="text"
              placeholder="Notas (opcional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
            />
            <button
              type="button"
              disabled={isPendingAssign}
              onClick={handleAssign}
              className="rounded-xl bg-black px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
            >
              {isPendingAssign ? 'Asignando…' : 'Asignar como crédito'}
            </button>
          </div>
        )}
      </div>

      {/* Pending credits */}
      {pendingCredits.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-black text-sm uppercase tracking-widest text-amber-600">Créditos pendientes</p>
            <p className="font-black text-lg text-amber-600">${pendingTotal.toLocaleString('es-AR')}</p>
          </div>

          <div className="space-y-2">
            {pendingCredits.map(c => (
              <label key={c.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  className="rounded"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{c.product.name} × {c.quantity}</p>
                  {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                </div>
                <p className="text-sm font-bold">${(c.unitPrice * c.quantity).toLocaleString('es-AR')}</p>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {Object.entries(METHOD_LABELS).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setPayMethod(v)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                  payMethod === v ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={isPendingPay}
            onClick={handlePay}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-all"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isPendingPay ? 'Saldando…' : `Saldar ${selectedIds.length ? `seleccionados` : 'todos'}`}
          </button>
        </div>
      )}

      {/* Paid credits history */}
      {paidCredits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Historial de créditos saldados</p>
          <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white divide-y divide-zinc-100">
            {paidCredits.map(c => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-semibold">{c.product.name} × {c.quantity}</p>
                  <p className="text-xs text-muted-foreground">
                    Saldado {c.paidAt ? new Date(c.paidAt).toLocaleDateString('es-AR') : ''}
                  </p>
                </div>
                <p className="font-bold text-zinc-400">${(c.unitPrice * c.quantity).toLocaleString('es-AR')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {credits.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-sm text-muted-foreground gap-2">
          <ShoppingBag className="h-8 w-8 opacity-20" />
          Sin créditos asignados
        </div>
      )}
    </div>
  )
}
