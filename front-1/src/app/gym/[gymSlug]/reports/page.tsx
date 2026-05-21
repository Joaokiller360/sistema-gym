import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { Gym } from '@/types'
import { ReportsTabs } from './ReportsTabs'

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
  searchParams: Promise<{ month?: string }>
}

export default async function ReportsPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { month } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const session = await verifyToken(token)
  const isSuperAdmin = session?.role === 'SUPER_ADMIN'

  const now = new Date()
  const targetMonth = month ? new Date(month + '-01') : now
  const startDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1).toISOString()
  const endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const gym = isSuperAdmin
    ? await apiFetch<Gym>(`/gyms/${gymSlug}`, token)
    : null
  const gymIdParam = isSuperAdmin && gym ? `&gymId=${gym.id}` : ''

  const [financial, retention, attendance] = await Promise.all([
    apiFetch<FinancialReport>(`/reports/financial?startDate=${startDate}&endDate=${endDate}${gymIdParam}`, token),
    apiFetch<RetentionReport>(`/reports/retention${isSuperAdmin && gym ? `?gymId=${gym.id}` : ''}`, token),
    apiFetch<AttendanceReport>(`/reports/attendance?startDate=${startDate}&endDate=${endDate}${gymIdParam}`, token),
  ])

  const monthStr = targetMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground text-sm mt-1 capitalize">{monthStr}</p>
      </div>

      <ReportsTabs
        gymSlug={gymSlug}
        financial={financial}
        retention={retention}
        attendance={attendance}
        defaultMonth={month ?? now.toISOString().slice(0, 7)}
      />
    </div>
  )
}
