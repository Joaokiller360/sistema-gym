'use client'

import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  value: string
  today: string
}

function shift(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function DateFilter({ value, today }: Props) {
  const router = useRouter()
  const isToday = value === today

  function go(date: string) {
    router.push(date === today ? '?' : `?date=${date}`)
  }

  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-adm-line bg-adm-surface">
      <button
        type="button"
        aria-label="Día anterior"
        onClick={() => go(shift(value, -1))}
        className="flex h-11 w-11 items-center justify-center text-adm-ink transition-colors hover:bg-adm-chip"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <label className="flex h-11 items-center gap-2 border-x border-adm-line px-3.5 text-sm font-semibold">
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        {isToday && <span>Hoy</span>}
        <span className="sr-only">Fecha</span>
        <input
          type="date"
          value={value}
          max={today}
          onChange={e => { if (e.target.value) go(e.target.value) }}
          className="bg-transparent font-inherit text-adm-ink outline-none [color-scheme:light] dark:[color-scheme:dark]"
        />
      </label>
      <button
        type="button"
        aria-label="Día siguiente"
        disabled={isToday}
        onClick={() => go(shift(value, 1))}
        className="flex h-11 w-11 items-center justify-center text-adm-ink transition-colors hover:bg-adm-chip disabled:text-adm-muted/50 disabled:hover:bg-transparent"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
