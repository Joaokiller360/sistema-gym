'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog'
import { PlanForm } from './PlanForm'

interface Props {
  gymSlug: string
}

export function NewPlanModal({ gymSlug }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(true)

  function close() {
    setIsOpen(false)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('new')
      router.push(`?${params.toString()}`)
    }, 120)
  }

  function handleSuccess() {
    toast.success('Plan creado correctamente')
    setIsOpen(false)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('new')
      router.push(`?${params.toString()}`)
      router.refresh()
    }, 120)
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) close() }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Nuevo plan</DialogTitle>
          <DialogDescription>Completá los datos para crear un nuevo plan.</DialogDescription>
        </DialogHeader>
        <PlanForm gymSlug={gymSlug} onSuccess={handleSuccess} onClose={close} showPreview={false} />
      </DialogContent>
    </Dialog>
  )
}
