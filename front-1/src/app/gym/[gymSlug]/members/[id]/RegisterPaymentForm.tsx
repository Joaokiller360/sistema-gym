'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { registerPaymentAction } from './actions'

interface Props {
  memberId: string
  gymSlug: string
  membershipId?: string
}

const METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD' },
  { value: 'ARS', label: 'ARS' },
  { value: 'EUR', label: 'EUR' },
  { value: 'BRL', label: 'BRL' },
]

export function RegisterPaymentForm({ memberId, gymSlug, membershipId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [method, setMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      toast.error('No se puede registrar un pago de $0 o menor.')
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await registerPaymentAction(gymSlug, memberId, {
        amount: amt,
        currency,
        method,
        notes: notes.trim() || undefined,
        membershipId: membershipId || undefined,
      })
      if (res.error) {
        toast.error(res.error)
        setError(res.error)
      } else {
        toast.success('Pago registrado correctamente')
        setOpen(false)
        setAmount('')
        setNotes('')
        router.refresh()
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-500 hover:border-[#fffb00] hover:text-black transition-all w-full justify-center"
      >
        <Plus className="h-4 w-4" />
        Registrar pago
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-[#fffb00] bg-[#fffb00]/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">Registrar pago</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Amount + currency */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Monto</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            required
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fffb00] focus:border-transparent transition-all"
          />
        </div>
        <div className="w-28 space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Moneda</label>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fffb00] focus:border-transparent transition-all appearance-none"
          >
            {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Method */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Método</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {METHODS.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={`rounded-xl py-2 text-xs font-semibold border-2 transition-all ${
                method === m.value
                  ? 'border-black bg-black text-white'
                  : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Notas (opcional)</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ej. Pago mensualidad enero"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fffb00] focus:border-transparent transition-all"
        />
      </div>

      {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl bg-black py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
        >
          {isPending ? 'Guardando…' : 'Confirmar pago'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
