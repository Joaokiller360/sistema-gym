import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import type { Gym } from '@/types'
import { AdminPage } from '@/components/admin/ui'
import { PlanEditor, type SubscriptionPlan } from './PlanEditor'

export default async function AdminPlansPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const [rawPlans, gymsRaw] = await Promise.all([
    apiFetch<SubscriptionPlan[]>('/admin/subscription-plans', token, {
      next: { tags: ['admin-subscription-plans'] },
    }),
    apiFetch<Gym[] | { data: Gym[] }>('/admin/gyms', token, { next: { tags: ['admin-gyms'] }, silent: true }),
  ])

  const plans = [...(rawPlans ?? [])].sort((a, b) => Number(a.price) - Number(b.price))
  const gyms = gymsRaw ? (Array.isArray(gymsRaw) ? gymsRaw : gymsRaw.data) : []
  const gymCounts: Record<string, number> = {}
  for (const g of gyms) {
    const key = g.subscriptionPlan?.toUpperCase()
    if (key) gymCounts[key] = (gymCounts[key] ?? 0) + 1
  }

  return (
    <AdminPage>
      <PlanEditor plans={plans} gymCounts={gymCounts} />
    </AdminPage>
  )
}
