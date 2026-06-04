import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { Gym } from '@/types'
import { BasicReports } from './BasicReports'
import { AdvancedReports } from './AdvancedReports'
import { type AdvancedReport } from '../dashboard/AdvancedReportsSection'

interface FinancialReport {
  totalRevenue: number
  currency: string
  byMethod: { method: string; total: number; count: number }[]
}

interface RetentionReport {
  activeCount: number
  expiredCount: number
  retentionRate: number
}

interface AttendanceReport {
  totalCheckins: number
  avgPerDay: number
  peakHour: string | null
}

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ month?: string; view?: string }>
}

// Compute UTC offset (ms) for a timezone at a given date (probe at noon to avoid DST edge)
function tzOffsetMs(year: number, month0: number, day: number, timezone: string): number {
  const probe = new Date(Date.UTC(year, month0, day, 12, 0, 0))
  const localStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(probe)
  const localAsUTC = new Date(localStr.replace(' ', 'T') + 'Z')
  return probe.getTime() - localAsUTC.getTime()
}

// Returns start/end ISO strings for a month in the given timezone
function monthBoundsInTZ(yearMonth: string, timezone: string) {
  const [y, m] = yearMonth.split('-').map(Number)
  const m0 = m - 1
  const lastDay = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()

  const startOffset = tzOffsetMs(y, m0, 1, timezone)
  const endOffset = tzOffsetMs(y, m0, lastDay, timezone)

  const startUTC = Date.UTC(y, m0, 1, 0, 0, 0, 0) + startOffset
  const endUTC = Date.UTC(y, m0, lastDay, 23, 59, 59, 999) + endOffset

  return {
    start: new Date(startUTC).toISOString(),
    end: new Date(endUTC).toISOString(),
  }
}

export default async function ReportsPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { month, view } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const session = await verifyToken(token)
  const isSuperAdmin = session?.role === 'SUPER_ADMIN'

  const now = new Date()
  const gym = await apiFetch<Gym>(`/gyms/${gymSlug}`, token)
  const gymTimezone = gym?.timezone || 'UTC'

  // Default month uses gym's timezone so "current month" is correct locally
  const defaultMonth = month ?? new Intl.DateTimeFormat('en-CA', {
    timeZone: gymTimezone, year: 'numeric', month: '2-digit',
  }).format(now).slice(0, 7)

  const { start: startDate, end: endDate } = monthBoundsInTZ(defaultMonth, gymTimezone)
  const prevMonth = (() => {
    const [y, m] = defaultMonth.split('-').map(Number)
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  })()
  const { start: prevStartDate, end: prevEndDate } = monthBoundsInTZ(prevMonth, gymTimezone)

  const gymIdParam = isSuperAdmin && gym ? `&gymId=${gym.id}` : ''
  const advancedEnabled = isSuperAdmin || (gym?.advancedReportsEnabled ?? false)
  const gymHeader = { headers: { 'x-gym-slug': gymSlug } }
  const isDaily = view === 'daily'
  const granularity = isDaily ? 'daily' : 'weekly'

  if (advancedEnabled) {
    const [advancedCurrent, advancedPrevious] = await Promise.all([
      apiFetch<AdvancedReport>(`/reports/advanced?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}`, token, gymHeader),
      isDaily
        ? Promise.resolve(null)
        : apiFetch<AdvancedReport>(`/reports/advanced?startDate=${prevStartDate}&endDate=${prevEndDate}&granularity=${granularity}`, token, gymHeader),
    ])

    return (
      <AdvancedReports
        defaultMonth={defaultMonth}
        view={isDaily ? 'daily' : 'monthly'}
        gymTimezone={gymTimezone}
        advancedCurrent={advancedCurrent}
        advancedPrevious={advancedPrevious}
      />
    )
  }

  const [financial, retention, attendance] = await Promise.all([
    apiFetch<FinancialReport>(`/reports/financial?startDate=${startDate}&endDate=${endDate}${gymIdParam}`, token),
    apiFetch<RetentionReport>(`/reports/retention${isSuperAdmin && gym ? `?gymId=${gym.id}` : ''}`, token),
    apiFetch<AttendanceReport>(`/reports/attendance?startDate=${startDate}&endDate=${endDate}${gymIdParam}`, token),
  ])

  return (
    <BasicReports
      defaultMonth={defaultMonth}
      financial={financial}
      retention={retention}
      attendance={attendance}
    />
  )
}
