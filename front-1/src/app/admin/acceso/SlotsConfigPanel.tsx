'use client'

import { useState, useTransition } from 'react'
import { Save, CheckCircle2 } from 'lucide-react'
import { updatePlatformSettingsAction } from '@/app/admin/settings/actions'
import { cn } from '@/lib/utils'
import { Panel, btn } from '@/components/admin/ui'

const ALL_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8
  const m = i % 2 === 0 ? '00' : '30'
  if (h > 20) return null
  return `${String(h).padStart(2, '0')}:${m}`
}).filter(Boolean) as string[]

export function SlotsConfigPanel({ initialSlots }: { initialSlots: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSlots))
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function toggle(slot: string) {
    setSaved(false)
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(slot)) next.delete(slot)
      else next.add(slot)
      return next
    })
  }

  function toggleAll() {
    setSaved(false)
    setSelected(selected.size === ALL_SLOTS.length ? new Set() : new Set(ALL_SLOTS))
  }

  function save() {
    startTransition(async () => {
      await updatePlatformSettingsAction({ availableSlots: Array.from(selected).sort() })
      setSaved(true)
    })
  }

  return (
    <Panel
      title={<>Horarios para reuniones <span className="ml-1 font-admin-mono text-[13px] font-medium text-adm-muted">{selected.size} activos</span></>}
      id="slots-h"
      action={
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleAll} disabled={isPending} className={btn.line}>
            {selected.size === ALL_SLOTS.length ? 'Quitar todos' : 'Seleccionar todos'}
          </button>
          <button type="button" onClick={save} disabled={isPending} className={btn.dark}>
            {saved ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {isPending ? 'Guardando…' : saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      }
      bodyClassName="flex flex-col gap-4 p-5"
    >
      <p className="text-[13px] text-adm-muted">
        Son los horarios que ve la gente al pedir acceso desde la landing. Activá los que querés ofrecer.
      </p>
      <SlotBlock label="Mañana" slots={ALL_SLOTS.filter(s => parseInt(s) < 13)} selected={selected} onToggle={toggle} />
      <SlotBlock label="Tarde" slots={ALL_SLOTS.filter(s => parseInt(s) >= 13)} selected={selected} onToggle={toggle} />
    </Panel>
  )
}

function SlotBlock({
  label, slots, selected, onToggle,
}: {
  label: string
  slots: string[]
  selected: Set<string>
  onToggle: (s: string) => void
}) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-adm-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {slots.map(slot => {
          const active = selected.has(slot)
          return (
            <button
              key={slot}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(slot)}
              className={cn(
                'min-h-9 rounded-lg border px-3 font-admin-mono text-[13px] font-bold transition-colors',
                active ? 'border-adm-ink bg-adm-ink text-adm-surface' : 'border-adm-line bg-adm-subtle text-adm-muted hover:border-adm-ink hover:text-adm-ink',
              )}
            >
              {slot}
            </button>
          )
        })}
      </div>
    </div>
  )
}
