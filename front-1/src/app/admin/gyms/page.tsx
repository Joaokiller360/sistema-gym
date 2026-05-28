import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Gym } from '@/types'
import { GymTable } from './GymTable'
import { SearchInput } from './SearchInput'
import { Pagination } from './Pagination'
import type { SubscriptionPlan } from './new/page'

const LIMIT = 20
const BACKEND_BASE = (process.env.API_URL ?? 'http://localhost:3001/api/v1').replace(/\/api\/v\d+$/, '')
const resolveLogoUrl = (url: string | null | undefined): string | null =>
  url?.startsWith('/') ? `${BACKEND_BASE}${url}` : url ?? null

interface GymsResponse {
  data: Gym[]
  total: number
  page: number
  limit: number
}

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function GymsPage({ searchParams }: Props) {
  const { q, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))

  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const qs = new URLSearchParams()
  if (q) qs.set('q', q)
  qs.set('page', String(page))
  qs.set('limit', String(LIMIT))

  const [raw, plans] = await Promise.all([
    apiFetch<GymsResponse | Gym[]>(
      `/admin/gyms?${qs.toString()}`,
      token,
      { next: { tags: ['admin-gyms'] } },
    ),
    apiFetch<SubscriptionPlan[]>('/admin/subscription-plans', token, {
      next: { tags: ['admin-subscription-plans'] },
    }),
  ])

  const gyms: Gym[] = (raw
    ? Array.isArray(raw)
      ? raw
      : raw.data
    : []
  ).map(g => ({ ...g, logoUrl: resolveLogoUrl(g.logoUrl) }))

  const total: number = raw
    ? Array.isArray(raw)
      ? raw.length
      : raw.total
    : 0

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  const activePlans = (plans ?? []).filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gimnasios</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {total > 0 ? `${total} gimnasio${total !== 1 ? 's' : ''} en total` : 'Sin gimnasios registrados'}
        </p>
      </div>

      <Suspense>
        <SearchInput defaultValue={q} />
      </Suspense>

      <GymTable gyms={gyms} plans={activePlans} />

      <Suspense>
        <Pagination currentPage={page} totalPages={totalPages} />
      </Suspense>
    </div>
  )
}
