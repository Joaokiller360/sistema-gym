'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog'
import { CheckInPanel } from '../attendance/CheckInPanel'
import { Member, AttendanceGroup } from '@/types'

interface Props {
  gymSlug: string
  members: Member[]
  groups: AttendanceGroup[]
}

export function QuickCheckInModalClient({ gymSlug, members, groups }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(true)

  function close() {
    setIsOpen(false)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('modal')
      router.push(`?${params.toString()}`)
    }, 120)
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) close() }}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Registrar entrada</DialogTitle>
          <DialogDescription>Buscá un miembro para registrar su asistencia.</DialogDescription>
        </DialogHeader>
        <div className="p-5">
          <CheckInPanel
            gymSlug={gymSlug}
            members={members}
            groups={groups}
            onSuccess={close}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
