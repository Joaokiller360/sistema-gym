'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateGymScheduleAction } from './actions'

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

interface DayHours { open: string; close: string }
type Schedule = Partial<Record<DayKey, DayHours | null>>

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: 'mon', label: 'Lunes',     short: 'Lun' },
  { key: 'tue', label: 'Martes',    short: 'Mar' },
  { key: 'wed', label: 'Miércoles', short: 'Mié' },
  { key: 'thu', label: 'Jueves',    short: 'Jue' },
  { key: 'fri', label: 'Viernes',   short: 'Vie' },
  { key: 'sat', label: 'Sábado',    short: 'Sáb' },
  { key: 'sun', label: 'Domingo',   short: 'Dom' },
]

const DEFAULT_HOURS: DayHours = { open: '06:00', close: '22:00' }

interface Props {
  gymSlug: string
  gymId: string
  defaultSchedule: Schedule
}

export function GymScheduleEditor({ gymSlug, gymId, defaultSchedule }: Props) {
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule)
  const [isPending, startTransition] = useTransition()

  function toggleDay(key: DayKey) {
    setSchedule(prev => {
      if (prev[key]) return { ...prev, [key]: null }
      return { ...prev, [key]: { ...DEFAULT_HOURS } }
    })
  }

  function updateHour(key: DayKey, field: 'open' | 'close', value: string) {
    setSchedule(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? DEFAULT_HOURS), [field]: value },
    }))
  }

  function handleSave() {
    startTransition(async () => {
      const payload: Record<string, DayHours | null> = {}
      for (const { key } of DAYS) payload[key] = schedule[key] ?? null
      const res = await updateGymScheduleAction(gymSlug, gymId, payload)
      if (res.error) toast.error(res.error)
      else toast.success('Horario guardado')
    })
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-zinc-200 overflow-hidden">
        {DAYS.map(({ key, label, short }, i) => {
          const enabled = !!schedule[key]
          const hours = schedule[key] ?? DEFAULT_HOURS
          return (
            <div
              key={key}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${i !== 0 ? 'border-t border-zinc-100' : ''} ${enabled ? 'bg-white' : 'bg-zinc-50'}`}
            >
              {/* Toggle */}
              <button
                type="button"
                onClick={() => toggleDay(key)}
                aria-label={enabled ? `Desactivar ${label}` : `Activar ${label}`}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  enabled ? 'bg-[#1fad9d]' : 'bg-zinc-200'
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>

              {/* Day label */}
              <span className={`w-20 text-sm font-semibold hidden sm:block ${enabled ? 'text-zinc-800' : 'text-zinc-400'}`}>
                {label}
              </span>
              <span className={`w-8 text-xs font-bold sm:hidden ${enabled ? 'text-zinc-800' : 'text-zinc-400'}`}>
                {short}
              </span>

              {/* Time inputs */}
              {enabled ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={hours.open}
                    onChange={e => updateHour(key, 'open', e.target.value)}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1fad9d]/40 focus:border-[#1fad9d] transition-all"
                  />
                  <span className="text-xs text-zinc-400 font-medium">—</span>
                  <input
                    type="time"
                    value={hours.close}
                    onChange={e => updateHour(key, 'close', e.target.value)}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1fad9d]/40 focus:border-[#1fad9d] transition-all"
                  />
                </div>
              ) : (
                <span className="flex-1 text-xs text-zinc-400">Cerrado</span>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-xl bg-black px-6 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
      >
        {isPending ? 'Guardando…' : 'Guardar horario'}
      </button>
    </div>
  )
}
