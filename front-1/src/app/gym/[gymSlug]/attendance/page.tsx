import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Attendance, AttendanceGroup, Member } from '@/types'
import { DateFilter } from './DateFilter'
import { CheckInPanel } from './CheckInPanel'
import { AttendanceList } from './AttendanceList'

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

export default async function AttendancePage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { date } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const gymHeader = { headers: { 'x-gym-slug': gymSlug } }

  const gymStatus = await apiFetch<{ timezone: string; localTime: string; isOpen: boolean }>(
    `/gyms/${gymSlug}/status`,
    token,
  )
  const tz = gymStatus?.timezone ?? 'UTC'

  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz })
  const activeDate = date ?? todayStr
  const isToday = activeDate === todayStr

  const { start: startDate, end: endDate } = gymDayBoundsISO(activeDate, tz)

  const [attendance, membersRaw, groups] = await Promise.all([
    apiFetch<AttendanceWithMember[]>(
      `/attendance?startDate=${startDate}&endDate=${endDate}`,
      token,
      { next: { tags: [`attendance-${gymSlug}`] }, ...gymHeader },
    ),
    apiFetch<MembersResponse | Member[]>('/members?limit=500', token, gymHeader),
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
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: tz,
  })

  // Stats: count per group
  const groupStats = gymGroups.map(g => ({
    name: g.name,
    count: records.filter(a => a.groupId === g.id).length,
  }))
  const ungroupedCount = records.filter(a => !a.groupId).length

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asistencia</h1>
          <p className="text-muted-foreground text-sm mt-1 capitalize">{displayDate}</p>
        </div>
        <DateFilter defaultValue={date ?? todayStr} />
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-white px-4 py-2.5 shadow-sm">
          <span className="text-xl font-black text-[#1fad9d] leading-none">{records.length}</span>
          <span className="text-xs font-semibold text-zinc-400">{isToday ? 'registros hoy' : 'registros'}</span>
        </div>
        {groupStats.filter(s => s.count > 0).map(s => (
          <div key={s.name} className="flex items-center gap-1.5 rounded-xl border border-zinc-100 bg-white px-3 py-2.5 shadow-sm">
            <span className="text-sm font-bold text-zinc-700">{s.count}</span>
            <span className="text-xs text-zinc-400 truncate max-w-[100px]">{s.name}</span>
          </div>
        ))}
        {ungroupedCount > 0 && gymGroups.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-100 bg-white px-3 py-2.5 shadow-sm">
            <span className="text-sm font-bold text-zinc-400">{ungroupedCount}</span>
            <span className="text-xs text-zinc-400">sin grupo</span>
          </div>
        )}
      </div>

      {/* Check-in */}
      {isToday && (
        <CheckInPanel
          gymSlug={gymSlug}
          members={members}
          groups={gymGroups}
        />
      )}

      {/* Records */}
      <AttendanceList
        gymSlug={gymSlug}
        records={records}
        groups={gymGroups}
        isToday={isToday}
      />
    </div>
  )
}
