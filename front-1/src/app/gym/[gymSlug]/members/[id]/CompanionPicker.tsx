'use client'

import { useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { createHandlers } from '@/lib/input-validation'

export interface CompanionCandidate {
  id: string
  firstName: string
  lastName: string
  email: string
  isActive: boolean
}

interface Props {
  candidates: CompanionCandidate[]
  /** Holder and anyone already in the group */
  excludeIds: string[]
  /** Members that already hold an active plan (can't be added) */
  busyIds?: Set<string>
  max: number
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export function CompanionPicker({ candidates, excludeIds, busyIds, max, value, onChange, disabled }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const selected = value.map(id => candidates.find(c => c.id === id)).filter((c): c is CompanionCandidate => !!c)
  const full = value.length >= max

  const results = q.length >= 2 && !full
    ? candidates
        .filter(c => !excludeIds.includes(c.id) && !value.includes(c.id))
        .filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
        .slice(0, 5)
    : []

  function add(id: string) {
    onChange([...value, id])
    setQuery('')
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map(c => (
            <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#1fad9d]/40 bg-[#1fad9d]/10 py-1 pl-3 pr-1 text-xs font-semibold text-[#0e7a70]">
              {c.firstName} {c.lastName}
              <button
                type="button"
                onClick={() => onChange(value.filter(v => v !== c.id))}
                disabled={disabled}
                aria-label={`Quitar a ${c.firstName} ${c.lastName}`}
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[#1fad9d]/20"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={disabled}
            aria-label="Buscar acompañante"
            placeholder={`Buscar acompañante (${value.length}/${max})…`}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm transition-all placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
            {...createHandlers('search')}
          />
        </div>
      )}

      {results.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {results.map(c => {
            const busy = busyIds?.has(c.id) ?? false
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={busy || disabled}
                  onClick={() => add(c.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#1fad9d]/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-zinc-800">{c.firstName} {c.lastName}</span>
                    <span className="block truncate text-xs text-zinc-400">{c.email}</span>
                  </span>
                  {busy && <span className="shrink-0 text-xs font-semibold text-zinc-500">Ya tiene plan</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {q.length >= 2 && !full && results.length === 0 && (
        <p className="text-xs text-zinc-500">Sin resultados. El acompañante tiene que estar registrado como miembro.</p>
      )}
    </div>
  )
}
