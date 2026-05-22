import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { ChevronLeft } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Plan } from '@/types'
import { PlanForm } from '../../PlanForm'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface Props {
  params: Promise<{ gymSlug: string; planId: string }>
}

export default async function EditPlanPage({ params }: Props) {
  const { gymSlug, planId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const plan = await apiFetch<Plan>(`/plans/${planId}`, token, {
    next: { tags: [`plan-${planId}`] },
    headers: { 'x-gym-slug': gymSlug },
  })

  if (!plan) notFound()

  const defaultValues = {
    name: plan.name,
    price: plan.price,
    currency: plan.currency,
    durationDays: plan.durationDays,
    daysPerWeek: plan.daysPerWeek === null ? 'unlimited' : String(plan.daysPerWeek),
    benefits: plan.benefits.map((b) => ({ value: b })),
    isActive: plan.isActive,
    isFeatured: plan.isFeatured,
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <Link
          href={`/gym/${gymSlug}/plans`}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            '-ml-2 mb-4 text-muted-foreground',
          )}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Volver a planes
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Editar plan</h1>
        <p className="text-muted-foreground text-sm mt-1">{plan.name}</p>
      </div>
      <PlanForm gymSlug={gymSlug} planId={planId} defaultValues={defaultValues} />
    </div>
  )
}
