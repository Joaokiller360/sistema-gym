'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, Search } from 'lucide-react'
import { toast } from 'sonner'
import { checkInAction } from './actions'
import { createHandlers } from '@/lib/input-validation'
import { Member, AttendanceGroup } from '@/types'
import { groupColor, initials } from './groupColors'
import { useT } from '@/i18n/client'
import { attendanceMessages } from './messages'

interface Props {
  gymSlug: string
  members: Member[]
  groups: AttendanceGroup[]
  // memberId → formatted check-in time, for members already inside today
  checkedIn?: Record<string, string>
  onSuccess?: () => void
}

export function CheckInPanel({ gymSlug, members, groups, checkedIn = {}, onSuccess }: Props) {
  const safeHandlers = createHandlers('search')
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Member | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const t = useT(attendanceMessages).checkIn

  const q = search.trim().toLowerCase()
  const filtered = q.length >= 2 && !selected
    ? members.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
      ).slice(0, 5)
    : []

  function checkIn(member: Member) {
    setError(null)
    startTransition(async () => {
      const res = await checkInAction(gymSlug, member.id, selectedGroup || undefined)
      if (res.error) {
        setError(res.error)
      } else {
        const name = `${member.firstName} ${member.lastName}`
        if (res.visitsRemaining != null) {
          toast.success(
            res.visitsRemaining === 0
              ? t.lastDay(name)
              : t.daysLeft(name, res.visitsRemaining),
          )
        } else {
          toast.success(t.logged(name))
        }
        setSearch('')
        setSelected(null)
        router.refresh()
        onSuccess?.()
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    safeHandlers.onKeyDown(e)
    if (e.key !== 'Enter') return
    e.preventDefault()
    const target = selected ?? filtered[0]
    if (target && !isPending) checkIn(target)
  }

  function selectMember(m: Member) {
    setSelected(m)
    setSearch(`${m.firstName} ${m.lastName}`)
    setError(null)
  }

  const shiftOptions = [{ id: '', name: t.none, idx: -1 }, ...groups.map((g, i) => ({ id: g.id, name: g.name, idx: i }))]

  return (
    <section aria-labelledby="checkin-h" className="flex flex-col gap-[18px] rounded-[20px] border border-adm-line bg-adm-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 id="checkin-h" className="text-xl font-extrabold">{t.title}</h2>
        <p className="text-sm text-adm-muted">{t.hint}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="checkin-search" className="text-xs font-bold uppercase tracking-[0.08em] text-adm-muted">
          {t.member}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-adm-muted" aria-hidden="true" />
          <input
            id="checkin-search"
            {...safeHandlers}
            type="search"
            autoComplete="off"
            value={search}
            onChange={e => { setSearch(e.target.value); if (selected) setSelected(null) }}
            onKeyDown={handleKeyDown}
            placeholder={t.placeholder}
            className="h-12 w-full rounded-xl border-2 border-adm-line bg-adm-surface pl-11 pr-4 text-base text-adm-ink outline-none transition-colors placeholder:text-adm-muted focus:border-[#1fad9d]"
          />
        </div>

        {filtered.length > 0 && (
          <ul aria-label={t.results} className="flex flex-col gap-0.5 rounded-xl border border-adm-line bg-adm-surface p-1.5 shadow-[0_8px_24px_rgba(18,20,19,0.08)]">
            {filtered.map((m, i) => {
              const name = `${m.firstName} ${m.lastName}`
              const inside = checkedIn[m.id]
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => selectMember(m)}
                    className={`flex min-h-[52px] w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-adm-ok-bg/60 ${i === 0 ? 'bg-adm-subtle' : ''}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-adm-chip text-xs font-extrabold text-adm-muted">
                      {initials(name)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-bold text-adm-ink">{name}</span>
                      <span className="truncate text-[13px] text-adm-muted">{m.email}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
                        inside
                          ? 'bg-adm-chip text-adm-muted'
                          : m.isActive
                          ? 'bg-adm-ok-bg text-adm-ok-fg'
                          : 'bg-adm-warn-bg text-adm-warn-fg'
                      }`}
                    >
                      {inside ? t.alreadyIn(inside) : m.isActive ? t.active : t.inactive}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {q.length >= 2 && !selected && filtered.length === 0 && (
          <p className="text-[13px] text-adm-muted">{t.noResults(search.trim())}</p>
        )}
      </div>

      {groups.length > 0 && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-xs font-bold uppercase tracking-[0.08em] text-adm-muted">{t.shift}</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(88px,1fr))] gap-1.5 rounded-xl bg-adm-chip p-1">
            {shiftOptions.map(opt => {
              const on = selectedGroup === opt.id
              return (
                <button
                  key={opt.id || 'none'}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedGroup(opt.id)}
                  className={`h-10 truncate rounded-[9px] px-2 text-[13px] transition-all ${
                    on
                      ? `bg-adm-surface font-extrabold shadow-[0_1px_3px_rgba(18,20,19,0.12)] ${groupColor(opt.idx).active}`
                      : 'font-semibold text-adm-muted hover:text-adm-ink'
                  }`}
                >
                  {opt.name}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {error && <p role="alert" className="text-[13px] font-medium text-adm-bad-fg">{error}</p>}

      <button
        type="button"
        onClick={() => { const target = selected ?? filtered[0]; if (target) checkIn(target) }}
        disabled={(!selected && filtered.length === 0) || isPending}
        className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] bg-[#0e7a70] text-base font-extrabold text-white transition-colors hover:bg-[#095a52] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <LogIn className="h-[18px] w-[18px]" aria-hidden="true" />
        {isPending ? t.logging : t.title}
      </button>
    </section>
  )
}
