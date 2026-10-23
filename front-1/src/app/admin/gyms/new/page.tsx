import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { AdminPage, PageHeader } from '@/components/admin/ui'
import { CreateGymForm } from './CreateGymForm'

export interface SubscriptionPlan {
  id: string
  key: string
  label: string
  price: number
  currency: string
  maxMembers: number | null
  features: string[]
  isActive: boolean
  sortOrder: number
}

export default async function NewGymPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const plans = await apiFetch<SubscriptionPlan[]>('/admin/subscription-plans', token, {
    next: { tags: ['admin-subscription-plans'] },
  }) ?? []

  return (
    <AdminPage>
      <PageHeader
        breadcrumb={[{ label: 'Gimnasios', href: '/admin/gyms' }, { label: 'Nuevo' }]}
        title="Nuevo gimnasio"
        eyebrow="El dueño recibe un correo de bienvenida con su acceso."
      />
      <CreateGymForm plans={plans.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder)} />
    </AdminPage>
  )
}
