'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Phone, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MemberStatusControl } from './[id]/MemberStatusControl'
import { ResendWelcomeButton } from './[id]/ResendWelcomeButton'
import { MemberTabs } from './[id]/MemberTabs'
import { deleteMemberAction } from './[id]/actions'
import type { Member, MembershipWithRelations, Payment, Attendance, Plan } from '@/types'

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

interface Props {
  member: Member
  memberships: MembershipWithRelations[]
  payments: Payment[]
  attendance: Attendance[]
  plans: Plan[]
  gymSlug: string
  canDelete: boolean
}

export function MemberModal({ member, memberships, payments, attendance, plans, gymSlug, canDelete }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  function close() {
    setIsOpen(false)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('member')
      router.push(`?${params.toString()}`)
    }, 120)
  }

  function handleDelete() {
    setConfirmDelete(false)
    startTransition(async () => {
      const res = await deleteMemberAction(gymSlug, member.id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`${member.firstName} ${member.lastName} eliminado`)
      setIsOpen(false)
      setTimeout(() => {
        router.push(`/gym/${gymSlug}/members`)
        router.refresh()
      }, 120)
    })
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={open => { if (!open) close() }}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[calc(100%-2rem)] sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto p-0"
        >
          <DialogTitle className="sr-only">
            {member.firstName} {member.lastName}
          </DialogTitle>

          <div className="p-6 space-y-6">
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-5">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="h-16 w-16 rounded-2xl bg-[#1fad9d]/10 flex items-center justify-center shrink-0">
                  <span className="text-xl font-black text-[#1fad9d]">
                    {initials(`${member.firstName} ${member.lastName}`)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-black tracking-tight">
                      {member.firstName} {member.lastName}
                    </h2>
                    <StatusBadge status={member.isActive ? 'active' : 'inactive'} />
                  </div>

                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {member.email}
                    </span>
                    {member.phone && (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        {member.phone}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-1.5">
                    Miembro desde {formatDate(member.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      disabled={isPending}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-[#ff0000] hover:bg-red-50 transition-all disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap items-start gap-6">
                <MemberStatusControl
                  memberId={member.id}
                  gymSlug={gymSlug}
                  isActive={member.isActive}
                />
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Correo</p>
                  <ResendWelcomeButton memberId={member.id} />
                </div>
              </div>
            </div>

            <MemberTabs
              memberId={member.id}
              gymSlug={gymSlug}
              memberships={memberships}
              payments={payments}
              attendance={attendance}
              plans={plans}
              memberIsActive={member.isActive}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar miembro</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que querés eliminar a {member.firstName} {member.lastName}? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[#ff0000] hover:bg-red-700 text-white"
            >
              Eliminar miembro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
