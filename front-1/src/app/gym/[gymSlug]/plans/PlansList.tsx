'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PlanCard } from '@/components/gym/PlanCard'
import { Plan } from '@/types'
import { togglePlanActiveAction, deletePlanAction } from './actions'

interface PlansListProps {
  plans: Plan[]
  gymSlug: string
}

export function PlansList({ plans, gymSlug }: PlansListProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function handleToggle(planId: string, active: boolean) {
    startTransition(async () => {
      await togglePlanActiveAction(gymSlug, planId, active)
      router.refresh()
    })
  }

  function handleDelete(planId: string) {
    startTransition(async () => {
      await deletePlanAction(gymSlug, planId)
      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          gymSlug={gymSlug}
          onToggleActive={handleToggle}
          onDelete={handleDelete}
        />
      ))}
    </div>
  )
}
