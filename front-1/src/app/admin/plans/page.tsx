import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { PlanEditor } from './PlanEditor'

interface SubscriptionPlan {
  id: string
  key: string
  label: string
  price: number
  currency: string
  maxMembers: number | null
  storeEnabled: boolean
  features: string[]
  isActive: boolean
  sortOrder: number
  discountPercent: number
  discountActive: boolean
  finalPrice: number
  discountSaving: number
  yearlyPrice: number | null
  yearlyFinalPrice: number | null
  yearlySaving: number | null
  yearlyMonthlyEquivalent: number | null
}

export default async function AdminPlansPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const rawPlans = await apiFetch<SubscriptionPlan[]>('/admin/subscription-plans', token, {
    next: { tags: ['admin-subscription-plans'] },
  }) ?? []

  const plans = [...rawPlans].sort((a, b) => Number(a.price) - Number(b.price))

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Planes de suscripción</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestioná los planes disponibles para los gimnasios y sus precios
        </p>
      </div>

      <PlanEditor plans={plans} />
    </div>
  )
}
