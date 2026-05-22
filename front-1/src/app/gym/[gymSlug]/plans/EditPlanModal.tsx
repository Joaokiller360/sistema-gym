'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog'
import { PlanForm } from './PlanForm'
import { Plan } from '@/types'

interface Props {
  gymSlug: string
  plan: Plan
}

export function EditPlanModal({ gymSlug, plan }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(true)

  function close() {
    setIsOpen(false)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('edit')
      router.push(`?${params.toString()}`)
    }, 120)
  }

  function handleSuccess() {
    toast.success('Plan actualizado correctamente')
    setIsOpen(false)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('edit')
      router.push(`?${params.toString()}`)
      router.refresh()
    }, 120)
  }

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
    <Dialog open={isOpen} onOpenChange={open => { if (!open) close() }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Editar plan</DialogTitle>
          <DialogDescription>{plan.name}</DialogDescription>
        </DialogHeader>
        <PlanForm
          gymSlug={gymSlug}
          planId={plan.id}
          defaultValues={defaultValues}
          onSuccess={handleSuccess}
          onClose={close}
          showPreview={false}
        />
      </DialogContent>
    </Dialog>
  )
}
