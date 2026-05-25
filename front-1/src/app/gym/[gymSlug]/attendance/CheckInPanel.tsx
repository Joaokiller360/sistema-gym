'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, LogOut, Search } from 'lucide-react'
import { checkInAction, checkOutAction } from './actions'
import { createHandlers } from '@/lib/input-validation'
import { Member, Attendance } from '@/types'

interface AttendanceWithMember extends Attendance {
  member?: { id: string; firstName: string; lastName: string } | null
}

interface Props {
  gymSlug: string
  activeNow: AttendanceWithMember[]
  members: Member[]
}

export function CheckInPanel({ gymSlug, activeNow, members }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Member | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [checkoutPending, setCheckoutPending] = useState<string | null>(null)

  const filtered = search.trim().length >= 2
    ? members.filter(m => {
        const q = search.toLowerCase()
        return (
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
        )
      }).slice(0, 6)
    : []

  function handleCheckIn() {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const res = await checkInAction(gymSlug, selected.id)
      if (res.error) {
        setError(res.error)
      } else {
        setSearch('')
        setSelected(null)
        router.refresh()
      }
    })
  }

  function handleCheckOut(memberId: string) {
    setCheckoutPending(memberId)
    startTransition(async () => {
      const res = await checkOutAction(gymSlug, memberId)
      setCheckoutPending(null)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Check-in panel */}
      <div className="rounded-2xl border-2 border-[#1fad9d]/30 bg-[#1fad9d]/5 p-6 space-y-4">
        <h2 className="font-bold text-sm uppercase tracking-widest text-[#1fad9d]">Registrar entrada</h2>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null) }}
            placeholder="Buscar miembro por nombre o email…"
            className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d] focus:border-transparent transition-all"
            {...createHandlers('search')}
          />
        </div>

        {filtered.length > 0 && !selected && (
          <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100 overflow-hidden">
            {filtered.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setSelected(m); setSearch(`${m.firstName} ${m.lastName}`) }}
                className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-[#1fad9d]/5 transition-colors text-left"
              >
                <span className="font-semibold">{m.firstName} {m.lastName}</span>
                <span className="text-zinc-400 text-xs">{m.email}</span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="rounded-xl border border-[#1fad9d] bg-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">{selected.firstName} {selected.lastName}</p>
              <p className="text-xs text-zinc-400">{selected.email}</p>
            </div>
            <button type="button" onClick={() => { setSelected(null); setSearch('') }} className="text-zinc-400 text-xs hover:text-zinc-700">✕</button>
          </div>
        )}

        {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}

        <button
          type="button"
          onClick={handleCheckIn}
          disabled={!selected || isPending}
          className="flex items-center gap-2 w-full justify-center rounded-xl bg-[#1fad9d] py-2.5 text-sm font-bold text-white hover:bg-[#0e7a70] disabled:opacity-50 transition-all"
        >
          <LogIn className="h-4 w-4" />
          {isPending ? 'Registrando…' : 'Registrar entrada'}
        </button>
      </div>

      {/* Currently in */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm uppercase tracking-widest text-zinc-400">En el gimnasio ahora</h2>
          <span className="text-2xl font-black text-[#1fad9d]">{activeNow.length}</span>
        </div>

        {activeNow.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nadie dentro ahora</p>
        ) : (
          <div className="space-y-2">
            {activeNow.map(a => {
              const name = a.member
                ? `${a.member.firstName} ${a.member.lastName}`
                : a.memberId.slice(0, 8) + '…'
              const sinceMin = Math.round((now - new Date(a.checkIn).getTime()) / 60_000)
              const since = sinceMin < 60 ? `${sinceMin} min` : `${Math.floor(sinceMin / 60)}h ${sinceMin % 60}m`

              return (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-sm">{name}</p>
                    <p className="text-xs text-zinc-400">Entró hace {since}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCheckOut(a.memberId)}
                    disabled={checkoutPending === a.memberId || isPending}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:border-[#ff0000]/30 hover:text-[#ff0000] disabled:opacity-50 transition-all"
                  >
                    <LogOut className="h-3 w-3" />
                    {checkoutPending === a.memberId ? '…' : 'Salida'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
