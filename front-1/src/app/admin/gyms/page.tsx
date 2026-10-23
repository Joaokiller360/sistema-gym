import Link from 'next/link'
import { cookies } from 'next/headers'
import { Plus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { normalizeLogoUrl } from '@/lib/utils'
import { Gym } from '@/types'
import { AdminPage, PageHeader, btn } from '@/components/admin/ui'
import { GymTable } from './GymTable'
import type { SubscriptionPlan } from './new/page'

interface GymsResponse {
  data: Gym[]
  total: number
}

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function GymsPage({ searchParams }: Props) {
  const { q } = await searchParams

  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const [raw, plans] = await Promise.all([
    apiFetch<GymsResponse | Gym[]>('/admin/gyms', token, { next: { tags: ['admin-gyms'] } }),
    apiFetch<SubscriptionPlan[]>('/admin/subscription-plans', token, {
      next: { tags: ['admin-subscription-plans'] },
    }),
  ])

  const gyms: Gym[] = (raw ? (Array.isArray(raw) ? raw : raw.data) : [])
    .map(g => ({ ...g, logoUrl: normalizeLogoUrl(g.logoUrl) }))

  const active = gyms.filter(g => g.isActive).length

  return (
    <AdminPage className="gap-5">
      <PageHeader
        eyebrow={gyms.length > 0 ? `${gyms.length} registrados · ${active} activos` : 'Sin gimnasios registrados'}
        title="Gimnasios"
        actions={
          <Link href="/admin/gyms/new" className={btn.primary}>
            <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
            Nuevo gimnasio
          </Link>
        }
      />
      <GymTable gyms={gyms} plans={plans ?? []} initialQuery={q ?? ''} />
    </AdminPage>
  )
}
