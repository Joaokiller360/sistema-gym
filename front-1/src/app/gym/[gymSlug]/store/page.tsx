import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { Gym } from '@/types'
import { StoreTabs } from './StoreTabs'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  cost: number | null
  stock: number
  category: string | null
  isActive: boolean
  _count: { saleItems: number }
}

interface CutSummary {
  salesCount: number
  total: number
  byMethod: { method: string; count: number; total: number }[]
  byProduct: { name: string; quantity: number; total: number }[]
}

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ tab?: string; date?: string; month?: string }>
}

export default async function StorePage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { tab = 'sell', date, month } = await searchParams

  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const headers = { 'x-gym-slug': gymSlug }

  const gym = await apiFetch<Gym>(`/gyms/${gymSlug}`, token, { next: { tags: [`gym-${gymSlug}`] } })
  if (!gym?.storeEnabled) redirect(`/gym/${gymSlug}/dashboard`)

  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [products, dailyCut, monthlyCut] = await Promise.all([
    apiFetch<Product[]>('/store/products', token, {
      next: { tags: [`store-products-${gymSlug}`] },
      headers,
    }).then(r => r ?? []),
    apiFetch<CutSummary>(`/store/cuts/daily?date=${date ?? today}`, token, { headers }),
    apiFetch<CutSummary>(`/store/cuts/monthly?month=${month ?? currentMonth}`, token, { headers }),
  ])

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Tienda</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ventas, productos y cortes de caja
        </p>
      </div>

      <Suspense>
        <StoreTabs
          gymSlug={gymSlug}
          products={products}
          dailyCut={dailyCut}
          monthlyCut={monthlyCut}
          activeTab={tab}
          dateParam={date ?? today}
          monthParam={month ?? currentMonth}
        />
      </Suspense>
    </div>
  )
}
