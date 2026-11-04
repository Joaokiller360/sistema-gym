import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import type { Gym } from '@/types'
import { AdminPage } from '@/components/admin/ui'
import type { SubscriptionPlan } from '../plans/PlanEditor'
import { MessagingClient, type AdminPack, type AdminPurchase, type MessagingSummary } from './MessagingClient'

export default async function AdminMessagingPage() {
  const token = (await cookies()).get('session')?.value ?? ''
  const opts = { next: { tags: ['admin-messaging'] } }

  const [summary, packs, purchases, plans, gymsRaw] = await Promise.all([
    apiFetch<MessagingSummary>('/admin/messaging/summary', token, opts),
    apiFetch<AdminPack[]>('/admin/messaging/packs', token, opts),
    apiFetch<AdminPurchase[]>('/admin/messaging/purchases', token, opts),
    apiFetch<SubscriptionPlan[]>('/admin/subscription-plans', token, { next: { tags: ['admin-subscription-plans', 'admin-messaging'] } }),
    apiFetch<Gym[] | { data: Gym[] }>('/admin/gyms', token, { next: { tags: ['admin-gyms'] }, silent: true }),
  ])

  const gyms = gymsRaw ? (Array.isArray(gymsRaw) ? gymsRaw : gymsRaw.data) : []
  const gymCounts: Record<string, number> = {}
  for (const g of gyms) {
    const key = g.subscriptionPlan?.toUpperCase()
    if (key) gymCounts[key] = (gymCounts[key] ?? 0) + 1
  }

  return (
    <AdminPage>
      <MessagingClient
        summary={summary}
        packs={packs ?? []}
        purchases={purchases ?? []}
        plans={[...(plans ?? [])].sort((a, b) => Number(a.price) - Number(b.price))}
        gymCounts={gymCounts}
      />
    </AdminPage>
  )
}
