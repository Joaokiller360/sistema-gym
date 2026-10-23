import Link from 'next/link'
import { cookies } from 'next/headers'
import { QrCode } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Attendance, AttendanceGroup, Gym, Member } from '@/types'
import { DateFilter } from './DateFilter'
import { CheckInPanel } from './CheckInPanel'
import { AttendanceList } from './AttendanceList'
import { GroupsCard } from './GroupsCard'
import { groupColor, initials } from './groupColors'

interface AttendanceWithMember extends Attendance {
  member?: { id: string; firstName: string; lastName: string } | null
}

interface MembersResponse { data: Member[]; total: number }

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ date?: string }>
}

// Compute UTC ISO start/end for a local date in a given timezone (no external libs needed)
function gymDayBoundsISO(dateStr: string, tz: string): { start: string; end: string } {
  const [year, month, day] = dateStr.split('-').map(Number)
  // Use noon UTC to safely determine the UTC offset (avoids DST-midnight edge cases)
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(noonUTC)
  const g = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0')
  const localNoonUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'))
  const offsetMs = noonUTC.getTime() - localNoonUTC
  return {
    start: new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + offsetMs).toISOString(),
    end:   new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) + offsetMs).toISOString(),
  }
}

function shiftDate(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function relativeMinutes(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'recién'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.floor(mins / 60)
  return `hace ${h} h`
}

export default async function AttendancePage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { date } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const gymHeader = { headers: { 'x-gym-slug': gymSlug } }

  const [gymStatus, gym] = await Promise.all([
    apiFetch<{ timezone: string; localTime: string; isOpen: boolean | null }>(`/gyms/${gymSlug}/status`, token),
    apiFetch<Gym>(`/gyms/${gymSlug}`, token, { next: { tags: [`gym-${gymSlug}`] } }),
  ])
  const tz = gymStatus?.timezone ?? 'UTC'

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz })
  const activeDate = date && date <= todayStr ? date : todayStr
  const isToday = activeDate === todayStr

  const { start: startDate, end: endDate } = gymDayBoundsISO(activeDate, tz)
  const lastWeek = gymDayBoundsISO(shiftDate(activeDate, -7), tz)

  const [attendance, lastWeekAttendance, membersRaw, groups] = await Promise.all([
    apiFetch<AttendanceWithMember[]>(
      `/attendance?startDate=${startDate}&endDate=${endDate}`,
      token,
      { next: { tags: [`attendance-${gymSlug}`] }, ...gymHeader },
    ),
    apiFetch<Attendance[]>(
      `/attendance?startDate=${lastWeek.start}&endDate=${lastWeek.end}`,
      token,
      { next: { tags: [`attendance-${gymSlug}`] }, ...gymHeader, silent: true },
    ),
    isToday ? apiFetch<MembersResponse | Member[]>('/members?limit=500', token, gymHeader) : Promise.resolve(null),
    apiFetch<AttendanceGroup[]>(
      '/attendance/groups',
      token,
      { next: { tags: [`attendance-groups-${gymSlug}`] }, ...gymHeader },
    ),
  ])

  const records = attendance ?? []
  const members: Member[] = membersRaw
    ? (Array.isArray(membersRaw) ? membersRaw : membersRaw.data)
    : []
  const gymGroups = groups ?? []

  const displayDate = new Date(activeDate + 'T12:00:00Z').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  const weekday = new Date(activeDate + 'T12:00:00Z').toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'UTC' })
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz })
  const hourOf = (iso: string) => parseInt(fmtTime(iso).slice(0, 2))

  // Per-shift counts
  const groupCounts: Record<string, number> = {}
  for (const r of records) if (r.groupId) groupCounts[r.groupId] = (groupCounts[r.groupId] ?? 0) + 1
  const ungroupedCount = records.filter(r => !r.groupId).length
  const breakdown = [
    ...gymGroups.map((g, i) => ({ key: g.id, name: g.name, count: groupCounts[g.id] ?? 0, dot: groupColor(i).dot })),
    ...(ungroupedCount > 0 || gymGroups.length === 0
      ? [{ key: 'none', name: 'Sin turno', count: ungroupedCount, dot: groupColor(-1).dot }]
      : []),
  ]

  const delta = lastWeekAttendance ? records.length - lastWeekAttendance.length : null

  // Hourly histogram (06–22 by default, widened if needed)
  const hourCounts = new Map<number, number>()
  for (const r of records) { const h = hourOf(r.checkIn); hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1) }
  const firstHour = Math.min(6, ...hourCounts.keys())
  const lastHour = Math.max(21, ...hourCounts.keys())
  const maxCount = Math.max(0, ...hourCounts.values())
  const peakHour = maxCount > 0 ? [...hourCounts.entries()].find(([, c]) => c === maxCount)![0] : null
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => {
    const h = firstHour + i
    return { h, count: hourCounts.get(h) ?? 0 }
  })
  const pad = (h: number) => String(h).padStart(2, '0')
  const axisLabels = Array.from({ length: 5 }, (_, i) => pad(Math.round(firstHour + ((lastHour + 1 - firstHour) * i) / 4)))

  // Latest check-in
  const latest = records.reduce<AttendanceWithMember | null>((acc, r) => (!acc || r.checkIn > acc.checkIn ? r : acc), null)
  const latestName = latest?.member ? `${latest.member.firstName} ${latest.member.lastName}` : null
  const latestGroup = latest?.groupId ? gymGroups.find(g => g.id === latest.groupId)?.name : null

  const checkedIn: Record<string, string> = {}
  for (const r of records) if (!checkedIn[r.memberId] || fmtTime(r.checkIn) < checkedIn[r.memberId]) checkedIn[r.memberId] = fmtTime(r.checkIn)

  return (
    <div className="admin-surface min-h-full bg-adm-ground px-4 pb-14 pt-8 sm:px-8 sm:pt-10">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6">

        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-adm-muted">
              {gym?.name ? `${gym.name} · ` : ''}Recepción
            </p>
            <h1 className="text-[34px] font-black leading-[1.05] tracking-[-0.02em] sm:text-[40px]">Asistencia</h1>
            <p className="text-[15px] capitalize text-adm-muted">{displayDate}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateFilter value={activeDate} today={todayStr} />
            <Link
              href={`/gym/${gymSlug}/attendance/scan`}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-adm-ink bg-adm-ink px-4 text-sm font-bold text-adm-surface transition-opacity hover:opacity-90"
            >
              <QrCode className="h-4 w-4" aria-hidden="true" />
              Escanear QR
            </Link>
          </div>
        </header>

        {/* KPIs */}
        <section aria-label="Resumen del día" className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          <div className="flex flex-col gap-3.5 rounded-2xl border border-adm-line bg-adm-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13px] font-semibold text-adm-muted">{isToday ? 'Entradas hoy' : 'Entradas'}</p>
              {delta !== null && (
                <p className="text-xs text-adm-muted">
                  vs. {weekday} pasado{' '}
                  <strong className={delta > 0 ? 'text-adm-ok-fg' : delta < 0 ? 'text-adm-bad-fg' : 'text-adm-ink'}>
                    {delta > 0 ? `+${delta}` : delta}
                  </strong>
                </p>
              )}
            </div>
            <p className="text-5xl font-black leading-none tracking-[-0.03em]">{records.length}</p>
            {records.length > 0 && (
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {breakdown.filter(b => b.count > 0).map(b => (
                  <div key={b.key} className={b.dot} style={{ flex: `${b.count} 1 0` }} />
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
              {breakdown.map(b => (
                <span key={b.key} className="inline-flex items-center gap-1.5 text-xs text-adm-muted">
                  <span className={`h-2.5 w-2.5 rounded-full ${b.dot}`} />
                  {b.name} <strong className="text-adm-ink">{b.count}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3.5 rounded-2xl border border-adm-line bg-adm-surface p-5">
            <p className="text-[13px] font-semibold text-adm-muted">Hora pico</p>
            <p className="text-[32px] font-extrabold leading-none tracking-[-0.02em]">
              {peakHour !== null ? `${pad(peakHour)}:00 – ${pad((peakHour + 1) % 24)}:00` : '—'}
            </p>
            <div className="flex h-11 items-end gap-1" aria-hidden="true">
              {hours.map(({ h, count }) => (
                <div
                  key={h}
                  className={`flex-1 rounded-[3px] ${h === peakHour ? 'bg-[#1fad9d]' : 'bg-adm-line'}`}
                  style={{ height: `${maxCount > 0 ? Math.max(3, (count / maxCount) * 44) : 3}px` }}
                />
              ))}
            </div>
            <div className="flex justify-between font-admin-mono text-[11px] text-adm-muted">
              {axisLabels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
          </div>

          <div className="flex flex-col gap-3.5 rounded-2xl border border-adm-line bg-adm-surface p-5">
            <p className="text-[13px] font-semibold text-adm-muted">Última entrada</p>
            {latest ? (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-adm-ok-bg text-[15px] font-extrabold text-adm-ok-fg">
                  {initials(latestName ?? '?')}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate text-lg font-bold">{latestName ?? 'Miembro'}</p>
                  <p className="text-[13px] text-adm-muted">
                    {fmtTime(latest.checkIn)}{latestGroup ? ` · ${latestGroup}` : ''}{isToday ? ` · ${relativeMinutes(latest.checkIn)}` : ''}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-adm-muted">Todavía no hay entradas.</p>
            )}
            {isToday && gymStatus?.isOpen != null && (
              <p className="mt-auto flex items-center gap-2 text-[13px] text-adm-muted">
                <span className={`h-2 w-2 rounded-full ${gymStatus.isOpen ? 'bg-[#1fad9d]' : 'bg-zinc-400'}`} />
                {gymStatus.isOpen ? 'Gimnasio abierto' : 'Gimnasio cerrado'} · {gymStatus.localTime}
              </p>
            )}
          </div>
        </section>

        {/* Check-in + shifts | day log */}
        <div className="flex flex-wrap items-start gap-6">
          <aside className="flex min-w-0 flex-[1_1_360px] flex-col gap-4 lg:max-w-[460px]">
            {isToday && (
              <CheckInPanel gymSlug={gymSlug} members={members} groups={gymGroups} checkedIn={checkedIn} />
            )}
            <GroupsCard gymSlug={gymSlug} groups={gymGroups} counts={groupCounts} isToday={isToday} />
          </aside>

          <AttendanceList gymSlug={gymSlug} records={records} groups={gymGroups} timezone={tz} date={activeDate} />
        </div>
      </div>
    </div>
  )
}
