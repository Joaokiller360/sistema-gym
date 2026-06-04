'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, Search, X } from 'lucide-react'
import { checkInAction } from './actions'
import { createHandlers } from '@/lib/input-validation'
import { Member, AttendanceGroup } from '@/types'

const GROUP_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
]

interface Props {
  gymSlug: string
  members: Member[]
  groups: AttendanceGroup[]
}

export function CheckInPanel({ gymSlug, members, groups }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Member | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = search.trim().length >= 2
    ? members.filter(m => {
        const q = search.toLowerCase()
        return (
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
        )
      }).slice(0, 5)
    : []

  function handleCheckIn() {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const res = await checkInAction(gymSlug, selected.id, selectedGroup || undefined)
      if (res.error) {
        setError(res.error)
      } else {
        setSearch('')
        setSelected(null)
        setSelectedGroup('')
        router.refresh()
      }
    })
  }

  function selectMember(m: Member) {
    setSelected(m)
    setSearch(`${m.firstName} ${m.lastName}`)
  }

  function clearSelection() {
    setSelected(null)
    setSearch('')
  }

  return (
    <div className="rounded-2xl border-2 border-[#1fad9d]/20 bg-gradient-to-br from-[#1fad9d]/5 to-transparent p-6">
      <div className="flex items-center gap-2 mb-5">
        <div className="h-8 w-8 rounded-xl bg-[#1fad9d]/10 flex items-center justify-center">
          <LogIn className="h-4 w-4 text-[#1fad9d]" />
        </div>
        <div>
          <h2 className="font-bold text-sm text-zinc-800">Registrar entrada</h2>
          <p className="text-[11px] text-zinc-400">Buscá un miembro para registrar su asistencia</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); if (selected) setSelected(null) }}
            placeholder="Nombre o email del miembro…"
            className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]/40 focus:border-[#1fad9d] transition-all placeholder:text-zinc-400"
            {...createHandlers('search')}
          />
        </div>

        {/* Dropdown results */}
        {filtered.length > 0 && !selected && (
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            {filtered.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMember(m)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#1fad9d]/5 transition-colors text-left"
              >
                <div className="h-7 w-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-black text-zinc-500">
                    {(m.firstName[0] + (m.lastName[0] ?? '')).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-zinc-800">{m.firstName} {m.lastName}</span>
                  <span className="block text-xs text-zinc-400 truncate">{m.email}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Selected member card */}
        {selected && (
          <div className="flex items-center gap-3 rounded-xl border border-[#1fad9d]/30 bg-[#1fad9d]/5 px-4 py-3">
            <div className="h-8 w-8 rounded-full bg-[#1fad9d]/20 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-black text-[#0e7a70]">
                {(selected.firstName[0] + (selected.lastName[0] ?? '')).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-zinc-800">{selected.firstName} {selected.lastName}</p>
              <p className="text-xs text-zinc-400 truncate">{selected.email}</p>
            </div>
            <button type="button" onClick={clearSelection} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Group select */}
        {groups.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Grupo</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedGroup('')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                  selectedGroup === ''
                    ? 'border-zinc-400 bg-zinc-800 text-white'
                    : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'
                }`}
              >
                Sin grupo
              </button>
              {groups.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGroup(g.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                    selectedGroup === g.id
                      ? `border-transparent ${GROUP_COLORS[i % GROUP_COLORS.length]}`
                      : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

        <button
          type="button"
          onClick={handleCheckIn}
          disabled={!selected || isPending}
          className="flex items-center gap-2 w-full justify-center rounded-xl bg-[#1fad9d] py-2.5 text-sm font-bold text-white hover:bg-[#0e7a70] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <LogIn className="h-4 w-4" />
          {isPending ? 'Registrando…' : 'Registrar entrada'}
        </button>
      </div>
    </div>
  )
}
