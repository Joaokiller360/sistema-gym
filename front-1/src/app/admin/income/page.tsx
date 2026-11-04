import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import {
  daysUntil,
  loadGymsWithBilling,
  loadPackSales,
  packSalesBetween,
  planPrice,
  recordsBetween,
  revenueBetween,
  sumByCurrency,
  type SubscriptionPlanPrice,
} from '@/lib/admin-billing'
import { AdminPage } from '@/components/admin/ui'
import { IncomeClient } from './IncomeClient'

export default async function AdminIncomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const now = new Date()

  const [gyms, subPlans, packSales] = await Promise.all([
    loadGymsWithBilling(token),
    apiFetch<SubscriptionPlanPrice[]>(`/admin/subscription-plans`, token),
    loadPackSales(token),
  ])
  const plans = subPlans ?? []

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevSameDay = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 23, 59, 59, 999)

  const monthly = revenueBetween(gyms, monthStart, now, packSales)
  const prev = revenueBetween(gyms, prevStart, prevSameDay, packSales)
  const monthDelta = monthly && prev && prev.currency === monthly.currency && prev.amount > 0
    ? ((monthly.amount - prev.amount) / prev.amount) * 100
    : null
  // Pack share of the month, in the headline currency
  const monthPacks = monthly
    ? packSalesBetween(packSales, monthStart, now)
        .filter(s => s.currency === monthly.currency)
        .reduce((sum, s) => sum + Number(s.price), 0)
    : 0

  const daily = revenueBetween(gyms, dayStart, now, packSales)
  const dailyCount =
    gyms.reduce((n, g) => n + recordsBetween(g, dayStart, now).length, 0) +
    packSalesBetween(packSales, dayStart, now).length

  const dueSoon = gyms.filter(g => {
    const s = g.subscription
    if (!s?.subscriptionExpiresAt || s.subscriptionStatus !== 'ACTIVE') return false
    const d = daysUntil(s.subscriptionExpiresAt, now)
    return d >= 0 && d <= 7
  })
  const overdue = gyms.filter(g => g.subscription?.subscriptionStatus === 'GRACE' || g.subscription?.subscriptionStatus === 'SUSPENDED')
  const priceOf = (list: typeof gyms) =>
    sumByCurrency(list.map(g => planPrice(plans, g.subscription?.subscriptionPlan ?? g.subscriptionPlan)).filter(m => m !== null))

  return (
    <AdminPage>
      <IncomeClient
        gyms={gyms}
        subPlans={plans}
        packSales={packSales}
        monthName={now.toLocaleDateString('es-AR', { month: 'long' })}
        prevMonthName={prevStart.toLocaleDateString('es-AR', { month: 'long' })}
        stats={{
          monthly,
          monthDelta,
          monthPacks,
          daily,
          dailyCount,
          dueSoon: priceOf(dueSoon),
          dueSoonCount: dueSoon.length,
          overdue: priceOf(overdue),
          overdueCount: overdue.length,
        }}
      />
    </AdminPage>
  )
}
