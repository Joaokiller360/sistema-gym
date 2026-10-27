'use client'

import { useState, useTransition } from 'react'
import { Trash2, Users } from 'lucide-react'
import { Attendance, AttendanceGroup } from '@/types'
import { deleteAttendanceAction } from './actions'
import { groupColor, initials } from './groupColors'
import { useIntlLocale, useT } from '@/i18n/client'
import { attendanceMessages } from './messages'

interface AttendanceWithMember extends Attendance {
  member?: { id: string; firstName: string; lastName: string } | null
}

interface Props {
  gymSlug: string
  records: AttendanceWithMember[]
  groups: AttendanceGroup[]
  timezone: string
  date: string
}

const NO_GROUP = '__none__'

function memberName(r: AttendanceWithMember) {
  return r.member ? `${r.member.firstName} ${r.member.lastName}` : r.memberId.slice(0, 8) + '…'
}

export function AttendanceList({ gymSlug, records, groups, timezone, date }: Props) {
  const [filter, setFilter] = useState<string>('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const t = useT(attendanceMessages).list
  const intl = useIntlLocale()

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })

  const groupIdx = new Map(groups.map((g, i) => [g.id, i]))
  const groupName = (r: AttendanceWithMember) => groups.find(g => g.id === r.groupId)?.name ?? t.noShift
  const keyOf = (r: AttendanceWithMember) => r.groupId ?? NO_GROUP

  const sorted = [...records].sort((a, b) => b.checkIn.localeCompare(a.checkIn))
  const visible = filter ? sorted.filter(r => keyOf(r) === filter) : sorted

  const tabs = [
    { key: '', label: t.all, count: records.length },
    ...groups.map(g => ({ key: g.id, label: g.name, count: records.filter(r => r.groupId === g.id).length })),
  ]
  const ungroupedCount = records.filter(r => !r.groupId).length
  if (groups.length > 0 && ungroupedCount > 0) tabs.push({ key: NO_GROUP, label: t.noShift, count: ungroupedCount })

  // Bucket visible records by hour, newest first
  const slots: { hour: string; items: AttendanceWithMember[] }[] = []
  for (const r of visible) {
    const hour = fmt(r.checkIn).slice(0, 2) + ':00'
    const last = slots[slots.length - 1]
    if (last?.hour === hour) last.items.push(r)
    else slots.push({ hour, items: [r] })
  }

  const uniqueMembers = new Set(records.map(r => r.memberId)).size

  function handleDelete(id: string) {
    setDeletingId(id)
    setError(null)
    startTransition(async () => {
      const res = await deleteAttendanceAction(gymSlug, id)
      setDeletingId(null)
      if (res.error) setError(res.error)
    })
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const rows = [
      t.csvHeaders,
      ...[...records].sort((a, b) => a.checkIn.localeCompare(b.checkIn)).map(r => [fmt(r.checkIn), memberName(r), groupName(r)]),
    ]
    const csv = '﻿' + rows.map(row => row.map(esc).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = t.csvName(date)
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section aria-labelledby="registro-h" className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-[20px] border border-adm-line bg-adm-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-adm-line-soft px-6 py-5">
        <h2 id="registro-h" className="text-xl font-extrabold">{t.title}</h2>
        {records.length > 0 && tabs.length > 1 && (
          <div role="tablist" aria-label={t.filterByShift} className="flex flex-wrap gap-1.5">
            {tabs.map(tab => {
              const on = filter === tab.key
              return (
                <button
                  key={tab.key || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setFilter(tab.key)}
                  className={`h-9 rounded-full border px-3 text-[13px] font-bold transition-colors ${
                    on
                      ? 'border-adm-ink bg-adm-ink text-adm-surface'
                      : 'border-adm-line bg-adm-surface text-adm-muted hover:text-adm-ink'
                  }`}
                >
                  {tab.label} <span className="opacity-75">{tab.count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {error && <p role="alert" className="px-6 pt-3 text-[13px] font-medium text-adm-bad-fg">{error}</p>}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-adm-chip">
            <Users className="h-5 w-5 text-adm-muted" aria-hidden="true" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">{t.empty}</p>
            <p className="mt-0.5 text-[13px] text-adm-muted">{t.emptyHint}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {slots.map(slot => (
            <div key={slot.hour} className="flex border-b border-adm-line-soft">
              <div className="w-[72px] shrink-0 py-4 pl-6 font-admin-mono text-[13px] font-semibold text-adm-muted sm:w-[88px]">
                {slot.hour}
              </div>
              <ul className="flex min-w-0 flex-1 flex-col py-1 pr-3">
                {slot.items.map(r => {
                  const name = memberName(r)
                  const color = groupColor(r.groupId ? groupIdx.get(r.groupId) ?? -1 : -1)
                  return (
                    <li key={r.id} className="group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-adm-subtle">
                      <span className="hidden w-11 shrink-0 font-admin-mono text-[13px] text-adm-muted sm:inline">{fmt(r.checkIn)}</span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-adm-chip text-xs font-extrabold text-adm-muted">
                        {initials(name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{name}</span>
                        <span className="block font-admin-mono text-xs text-adm-muted sm:hidden">{fmt(r.checkIn)}</span>
                      </span>
                      {groups.length > 0 && (
                        <span className={`shrink-0 truncate rounded-full px-2.5 py-1 text-xs font-bold ${color.tag}`}>{groupName(r)}</span>
                      )}
                      <button
                        type="button"
                        aria-label={t.deleteRecord(name)}
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-adm-muted transition-colors hover:bg-adm-bad-bg hover:text-adm-bad-fg disabled:opacity-40"
                      >
                        <Trash2 className="h-[15px] w-[15px]" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 bg-adm-subtle px-6 py-3.5 text-[13px] text-adm-muted">
        <span>
          {t.records(records.length)} · {t.unique(uniqueMembers)}
        </span>
        {records.length > 0 && (
          <button type="button" onClick={exportCsv} className="font-bold text-[#0e7a70] hover:text-[#095a52] dark:text-adm-ok-fg">
            {t.exportCsv}
          </button>
        )}
      </div>
    </section>
  )
}
