'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateGymScheduleAction } from './actions'
import { useIntlLocale, useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'
import { settingsMessages } from './messages'

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

interface DayHours { open: string; close: string }
type Schedule = Partial<Record<DayKey, DayHours | null>>

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const DEFAULT_HOURS: DayHours = { open: '06:00', close: '22:00' }

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

interface Props {
  gymSlug: string
  gymId: string
  defaultSchedule: Schedule
}

export function GymScheduleEditor({ gymSlug, gymId, defaultSchedule }: Props) {
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule)
  const [isPending, startTransition] = useTransition()
  const t = useT(settingsMessages).schedule
  const tc = useT(commonMessages)
  const intlLocale = useIntlLocale()
  const DAYS = DAY_KEYS.map(key => ({ key, label: tc.weekdays[key], short: tc.weekdaysShort[key] }))

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

  function copyMondayToWeekdays() {
    setSchedule(prev => {
      const mon = prev.mon ?? null
      const next = { ...prev }
      for (const key of ['tue', 'wed', 'thu', 'fri'] as const) next[key] = mon ? { ...mon } : null
      return next
    })
  }

  function handleSave() {
    startTransition(async () => {
      const payload: Record<string, DayHours | null> = {}
      for (const { key } of DAYS) payload[key] = schedule[key] ?? null
      const res = await updateGymScheduleAction(gymSlug, gymId, payload)
      if (res.error) toast.error(res.error)
      else toast.success(t.saved)
    })
  }

  const openDays = DAYS.filter(d => schedule[d.key]).length
  const weeklyMinutes = DAYS.reduce((sum, { key }) => {
    const h = schedule[key]
    return h ? sum + Math.max(0, toMinutes(h.close) - toMinutes(h.open)) : sum
  }, 0)
  const weeklyHours = Math.round(weeklyMinutes / 6) / 10

  return (
    <section aria-labelledby="schedule-h" className="flex flex-col gap-[18px] rounded-[20px] border border-adm-line bg-adm-surface p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="schedule-h" className="text-[17px] font-extrabold">{t.title}</h2>
          <p className="font-admin-mono text-[13px] text-adm-muted">
            {t.summary(openDays, weeklyHours.toLocaleString(intlLocale))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyMondayToWeekdays}
            disabled={isPending}
            className="h-10 rounded-[10px] border border-adm-line px-3.5 text-[13px] font-bold transition-colors hover:bg-adm-chip disabled:opacity-50"
          >
            {t.copyMonday}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="h-10 rounded-[10px] bg-adm-brand px-4 text-[13px] font-black text-adm-night transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? tc.saving : t.save}
          </button>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="grid min-w-[640px] grid-cols-[36px_repeat(7,minmax(0,1fr))] gap-2">
          <div className="flex h-[260px] flex-col justify-between pt-[34px] font-admin-mono text-[11px] text-adm-muted" aria-hidden="true">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
          </div>
          {DAYS.map(({ key, label, short }) => {
            const enabled = !!schedule[key]
            const hours = schedule[key] ?? DEFAULT_HOURS
            const top = (toMinutes(hours.open) / 1440) * 100
            const height = Math.max(0, ((toMinutes(hours.close) - toMinutes(hours.open)) / 1440) * 100)
            return (
              <div key={key} className="flex min-w-0 flex-col gap-2">
                <p className="flex h-[26px] items-center justify-center text-[13px] font-extrabold uppercase tracking-[0.06em] text-adm-ink">{short}</p>
                <div className="relative h-[226px] overflow-hidden rounded-xl border border-adm-line bg-adm-ground" aria-hidden="true">
                  {enabled && (
                    <div
                      className={`absolute inset-x-1.5 rounded-lg ${key === 'mon' ? 'bg-adm-brand' : 'border border-adm-muted/40 bg-adm-line'}`}
                      style={{ top: `${top}%`, height: `${height}%` }}
                    />
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={enabled ? t.closeDay(label) : t.openDay(label)}
                  onClick={() => toggleDay(key)}
                  className={`h-10 rounded-[10px] text-xs font-extrabold transition-colors ${
                    enabled ? 'border border-adm-line bg-adm-subtle text-adm-ink' : 'border border-dashed border-adm-line text-adm-muted hover:text-adm-ink'
                  }`}
                >
                  {enabled ? t.open : t.closed}
                </button>
                {enabled ? (
                  <div className="flex flex-col gap-1">
                    <label className="sr-only" htmlFor={`open-${key}`}>{t.opening(label)}</label>
                    <input
                      id={`open-${key}`}
                      type="time"
                      value={hours.open}
                      onChange={e => updateHour(key, 'open', e.target.value)}
                      className="h-9 w-full rounded-lg border border-adm-line bg-adm-ground px-1 text-center font-admin-mono text-[13px] font-bold text-adm-ink outline-none dark:[color-scheme:dark] focus:border-adm-ink dark:focus:border-adm-brand"
                    />
                    <label className="sr-only" htmlFor={`close-${key}`}>{t.closing(label)}</label>
                    <input
                      id={`close-${key}`}
                      type="time"
                      value={hours.close}
                      onChange={e => updateHour(key, 'close', e.target.value)}
                      className="h-9 w-full rounded-lg border border-adm-line bg-adm-ground px-1 text-center font-admin-mono text-[13px] font-bold text-adm-ink outline-none dark:[color-scheme:dark] focus:border-adm-ink dark:focus:border-adm-brand"
                    />
                  </div>
                ) : (
                  <p className="flex h-[76px] items-center justify-center font-admin-mono text-[13px] text-adm-muted">—</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-[13px] text-adm-muted">
        {t.hint}
      </p>
    </section>
  )
}
