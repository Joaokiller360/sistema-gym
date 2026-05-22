'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog'
import { NewMemberForm } from './new/NewMemberForm'

interface Props {
  gymSlug: string
}

export function NewMemberModal({ gymSlug }: Props) {
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

  function handleSuccess(memberId: string) {
    toast.success('Miembro creado correctamente')
    setIsOpen(false)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('new')
      params.set('member', memberId)
      router.push(`?${params.toString()}`)
      router.refresh()
    }, 120)
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) close() }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Nuevo miembro</DialogTitle>
          <DialogDescription>Completá los datos del nuevo miembro.</DialogDescription>
        </DialogHeader>
        <NewMemberForm gymSlug={gymSlug} onSuccess={handleSuccess} onClose={close} />
      </DialogContent>
    </Dialog>
  )
}
