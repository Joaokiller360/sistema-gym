'use client'

import { useTransition } from 'react'
import { PlanCard } from '@/components/gym/PlanCard'
import { Plan } from '@/types'
import { togglePlanActiveAction, deletePlanAction } from './actions'

interface PlansListProps {
  plans: Plan[]
  gymSlug: string
}

export function PlansList({ plans, gymSlug }: PlansListProps) {
  const [, startTransition] = useTransition()

  function handleToggle(planId: string, active: boolean) {
    startTransition(async () => {
      await togglePlanActiveAction(gymSlug, planId, active)
    })
  }

  function handleDelete(planId: string) {
    startTransition(async () => {
      await deletePlanAction(gymSlug, planId)
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
