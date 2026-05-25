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

interface StoreCutSummary {
  salesCount: number
  total: number
  byMethod: { method: string; count: number; total: number }[]
  byProduct: { name: string; quantity: number; total: number }[]
}

interface PendingCredit {
  id: string
  memberId: string
  member: { firstName: string; lastName: string }
  productId: string
  quantity: number
  unitPrice: number
  notes: string | null
  createdAt: string
  product: { name: string }
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
  const monthParam = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}`

  const gym = await apiFetch<Gym>(`/gyms/${gymSlug}`, token)
  const gymIdParam = isSuperAdmin && gym ? `&gymId=${gym.id}` : ''
  const storeEnabled = gym?.storeEnabled ?? false

  const [financial, retention, attendance, storeSales, pendingCredits] = await Promise.all([
    apiFetch<FinancialReport>(`/reports/financial?startDate=${startDate}&endDate=${endDate}${gymIdParam}`, token),
    apiFetch<RetentionReport>(`/reports/retention${isSuperAdmin && gym ? `?gymId=${gym.id}` : ''}`, token),
    apiFetch<AttendanceReport>(`/reports/attendance?startDate=${startDate}&endDate=${endDate}${gymIdParam}`, token),
    storeEnabled
      ? apiFetch<StoreCutSummary>(`/store/cuts/monthly?month=${monthParam}`, token, {
          headers: { 'x-gym-slug': gymSlug },
        })
      : Promise.resolve(null),
    storeEnabled
      ? apiFetch<PendingCredit[]>('/store/credits', token, {
          headers: { 'x-gym-slug': gymSlug },
        }).then(r => r ?? [])
      : Promise.resolve([]),
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
        storeSales={storeSales}
        storeEnabled={storeEnabled}
        defaultMonth={month ?? now.toISOString().slice(0, 7)}
        pendingCredits={pendingCredits}
      />
    </div>
  )
}
