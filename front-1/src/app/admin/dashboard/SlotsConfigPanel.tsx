'use client'

import { useState, useTransition } from 'react'
import { Clock, Save, CheckCircle2 } from 'lucide-react'
import { updatePlatformSettingsAction } from '@/app/admin/settings/actions'

const ALL_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8
  const m = i % 2 === 0 ? '00' : '30'
  if (h > 20) return null
  return `${String(h).padStart(2, '0')}:${m}`
}).filter(Boolean) as string[]

const DAYS = [
  { key: 'mon', label: 'Lun' },
  { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mié' },
  { key: 'thu', label: 'Jue' },
  { key: 'fri', label: 'Vie' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
]

export function SlotsConfigPanel({ initialSlots }: { initialSlots: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSlots))
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function toggle(slot: string) {
    setSaved(false)
    setSelected(prev => {
      const next = new Set(prev)
      next.has(slot) ? next.delete(slot) : next.add(slot)
      return next
    })
  }

  function toggleAll() {
    setSaved(false)
    if (selected.size === ALL_SLOTS.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(ALL_SLOTS))
    }
  }

  function save() {
    startTransition(async () => {
      await updatePlatformSettingsAction({ availableSlots: Array.from(selected).sort() })
      setSaved(true)
    })
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-400" />
          <h2 className="font-semibold text-sm">Horarios disponibles para reuniones</h2>
          <span className="text-xs text-zinc-400 font-medium">({selected.size} activos)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAll}
            disabled={isPending}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
          >
            {selected.size === ALL_SLOTS.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
          <button
            onClick={save}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            {saved ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Guardado</>
            ) : (
              <><Save className="h-3.5 w-3.5" /> Guardar</>
            )}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-xs text-zinc-400">
          Estos son los horarios que verán los usuarios al pedir acceso desde la landing. Activá los que querés ofrecer.
        </p>

        {/* Morning block */}
        <SlotBlock
          label="Mañana"
          slots={ALL_SLOTS.filter(s => parseInt(s) < 13)}
          selected={selected}
          onToggle={toggle}
        />

        {/* Afternoon block */}
        <SlotBlock
          label="Tarde"
          slots={ALL_SLOTS.filter(s => parseInt(s) >= 13)}
          selected={selected}
          onToggle={toggle}
        />
      </div>
    </div>
  )
}

function SlotBlock({
  label, slots, selected, onToggle
}: {
  label: string
  slots: string[]
  selected: Set<string>
  onToggle: (s: string) => void
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {slots.map(slot => {
          const active = selected.has(slot)
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onToggle(slot)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                active
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-zinc-50 text-zinc-400 border-zinc-200 hover:border-zinc-400 hover:text-zinc-700'
              }`}
            >
              {slot}
            </button>
          )
        })}
      </div>
    </div>
  )
}
