import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { Gym, ProductCategory } from '@/types'
import { StoreTabs } from './StoreTabs'

interface Product {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  cost: number | null
  stock: number
  categoryId: string | null
  category: { id: string; name: string; imageUrl: string | null } | null
  isActive: boolean
  _count: { saleItems: number }
}

interface CreditPeriodItem {
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

interface CutSummary {
  salesCount: number
  total: number
  byMethod: { method: string; count: number; total: number }[]
  byProduct: { name: string; quantity: number; total: number }[]
  sales: { id: string; total: number; method: string; notes: string | null; createdAt: string; items: { productId: string; quantity: number; unitPrice: number; product: { name: string } }[] }[]
  credits: {
    count: number
    total: number
    byMember: { memberName: string; count: number; total: number }[]
    items: CreditPeriodItem[]
  }
}

interface Member {
  id: string
  firstName: string
  lastName: string
  email: string
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
  searchParams: Promise<{ tab?: string; date?: string; month?: string }>
}

export default async function StorePage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { tab = 'sell', date, month } = await searchParams

  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const headers = { 'x-gym-slug': gymSlug }

  const session = await verifyToken(token)
  const isSuperAdmin = session?.role === 'SUPER_ADMIN'
  const canDeleteSales = isSuperAdmin || session?.role === 'GYM_OWNER'

  const gym = await apiFetch<Gym>(`/gyms/${gymSlug}`, token, { next: { tags: [`gym-${gymSlug}`] } })
  if (!gym?.storeEnabled) redirect(`/gym/${gymSlug}/dashboard`)

  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [products, categories, dailyCut, monthlyCut, members, pendingCredits] = await Promise.all([
    apiFetch<Product[]>('/store/products', token, {
      next: { tags: [`store-products-${gymSlug}`] },
      headers,
    }).then(r => r ?? []),
    apiFetch<ProductCategory[]>('/store/categories', token, {
      next: { tags: [`store-categories-${gymSlug}`] },
      headers,
    }).then(r => r ?? []),
    apiFetch<CutSummary>(`/store/cuts/daily?date=${date ?? today}`, token, { headers }),
    apiFetch<CutSummary>(`/store/cuts/monthly?month=${month ?? currentMonth}`, token, { headers }),
    apiFetch<Member[]>('/members', token, { headers }).then(r => r ?? []),
    apiFetch<PendingCredit[]>('/store/credits', token, {
      next: { tags: [`store-credits-${gymSlug}`] },
      headers,
    }).then(r => r ?? []),
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
          categories={categories}
          dailyCut={dailyCut}
          monthlyCut={monthlyCut}
          activeTab={tab}
          dateParam={date ?? today}
          monthParam={month ?? currentMonth}
          members={members}
          pendingCredits={pendingCredits}
          canDelete={isSuperAdmin}
          canDeleteSales={canDeleteSales}
        />
      </Suspense>
    </div>
  )
}
