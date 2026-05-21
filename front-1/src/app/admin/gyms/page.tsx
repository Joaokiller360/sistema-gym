import Link from 'next/link'
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { Plus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Gym } from '@/types'
import { GymTable } from './GymTable'
import { SearchInput } from './SearchInput'
import { Pagination } from './Pagination'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const LIMIT = 20

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

  const raw = await apiFetch<GymsResponse | Gym[]>(
    `/admin/gyms?${qs.toString()}`,
    token,
    { next: { tags: ['admin-gyms'] } },
  )

  const gyms: Gym[] = raw
    ? Array.isArray(raw)
      ? raw
      : raw.data
    : []

  const total: number = raw
    ? Array.isArray(raw)
      ? raw.length
      : raw.total
    : 0

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gimnasios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total > 0 ? `${total} gimnasio${total !== 1 ? 's' : ''} en total` : 'Sin gimnasios registrados'}
          </p>
        </div>
        <Link href="/admin/gyms/new" className={cn(buttonVariants())}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo gimnasio
        </Link>
      </div>

      <Suspense>
        <SearchInput defaultValue={q} />
      </Suspense>

      <GymTable gyms={gyms} />

      <Suspense>
        <Pagination currentPage={page} totalPages={totalPages} />
      </Suspense>
    </div>
  )
}
