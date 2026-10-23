'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog'
import { NewPaymentForm } from '../payments/new/NewPaymentForm'
import type { Member, Plan } from '@/types'

interface Props {
  gymSlug: string
  members: Member[]
  plans: Plan[]
  initialMemberId?: string
}

export function NewPaymentModal({ gymSlug, members, plans, initialMemberId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(true)

  function close() {
    setIsOpen(false)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('new')
      params.delete('payFor')
      router.push(`?${params.toString()}`)
    }, 120)
  }

  function handleSuccess(memberId: string) {
    toast.success('Pago registrado correctamente')
    setIsOpen(false)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('new')
      params.delete('payFor')
      params.set('member', memberId)
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
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>Seleccioná el miembro y el plan. Se creará la membresía y el pago automáticamente.</DialogDescription>
        </DialogHeader>
        <NewPaymentForm
          gymSlug={gymSlug}
          members={members}
          plans={plans}
          onSuccess={handleSuccess}
          onClose={close}
          initialMemberId={initialMemberId}
        />
      </DialogContent>
    </Dialog>
  )
}
