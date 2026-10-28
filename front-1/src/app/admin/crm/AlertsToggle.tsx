'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/admin/ui'
import { setAlertsPausedAction } from './actions'

/** Manual pause for the automatic WhatsApp alerts (plan limit). Held-back alerts go out once resumed. */
export function AlertsToggle({ initialPaused }: { initialPaused: boolean }) {
  const [paused, setPaused] = useState(initialPaused)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(active: boolean) {
    const prev = paused
    setPaused(!active)
    setError(null)
    startTransition(async () => {
      const res = await setAlertsPausedAction(!active)
      if (res.error) { setPaused(prev); setError(res.error) }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3 rounded-xl border border-adm-line bg-adm-surface px-3.5 py-2">
        <div className="text-right">
          <p className="text-sm font-semibold">Avisos automáticos</p>
          <p className="text-xs text-adm-muted">
            {paused ? 'Pausados: se envían al reactivar' : 'Activos: límite de plan'}
          </p>
        </div>
        <Switch checked={!paused} onChange={toggle} disabled={isPending} label="Avisos automáticos de WhatsApp" />
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-adm-bad-fg">{error}</p>}
    </div>
  )
}
