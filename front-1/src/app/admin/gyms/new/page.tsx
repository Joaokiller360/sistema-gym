import { cookies } from 'next/headers'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
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
    <div className="p-8 space-y-6">
      <div>
        <Link
          href="/admin/gyms"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            '-ml-2 mb-4 text-muted-foreground',
          )}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Volver a gimnasios
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo gimnasio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Registrá un nuevo gimnasio en la plataforma
        </p>
      </div>
      <CreateGymForm plans={plans.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder)} />
    </div>
  )
}
