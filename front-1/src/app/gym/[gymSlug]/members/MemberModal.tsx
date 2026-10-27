'use client'

import { useState, useTransition, type ComponentProps } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarCheck, CreditCard, Mail, Pencil, Phone, Ticket, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
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
import { MemberStatusControl } from './[id]/MemberStatusControl'
import { ResendWelcomeButton } from './[id]/ResendWelcomeButton'
import { MemberTabs } from './[id]/MemberTabs'
import { WalletPassCard } from './[id]/WalletPassCard'
import type { WalletPassInfo } from './[id]/wallet-actions'
import type { CompanionCandidate } from './[id]/CompanionPicker'
import { deleteMemberAction } from './[id]/actions'
import type { Member, MembershipWithRelations, Payment, Attendance, Plan } from '@/types'
import { useIntlLocale, useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'
import { membersMessages } from './messages'

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatDate(iso: string, intl: string) {
  return new Date(iso).toLocaleDateString(intl, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatShort(iso: string, intl: string) {
  return new Date(iso).toLocaleDateString(intl, { day: '2-digit', month: 'short' })
}

function daysLeft(endDate: string) {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000))
}

interface Props {
  member: Member
  memberships: MembershipWithRelations[]
  payments: Payment[]
  attendance: Attendance[]
  plans: Plan[]
  gymSlug: string
  canDelete: boolean
  canRevokeWallet: boolean
  walletPass: WalletPassInfo | null
  storeProducts: NonNullable<ComponentProps<typeof MemberTabs>['storeProducts']>
  memberCredits: NonNullable<ComponentProps<typeof MemberTabs>['memberCredits']>
  candidates: CompanionCandidate[]
  busyIds: string[]
}

export function MemberModal({
  member, memberships, payments, attendance, plans, gymSlug, canDelete,
  canRevokeWallet, walletPass, storeProducts, memberCredits, candidates, busyIds,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const t = useT(membersMessages).modal
  const tc = useT(commonMessages)
  const intl = useIntlLocale()

  const fullName = `${member.firstName} ${member.lastName}`

  const activeMembership = memberships.find(m => m.status === 'ACTIVE')
  const remaining = activeMembership ? daysLeft(activeMembership.endDate) : null
  const lastVisit = attendance.reduce<string | null>((acc, a) => (!acc || a.checkIn > acc ? a.checkIn : acc), null)
  const lastPayment = payments.reduce<Payment | null>((acc, p) => (!acc || p.createdAt > acc.createdAt ? p : acc), null)
  const currency = lastPayment?.currency ?? activeMembership?.plan?.currency ?? 'ARS'
  const paidTotal = payments
    .filter(p => p.currency === currency)
    .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0)

  function editHref() {
    const params = new URLSearchParams(searchParams.toString())
    params.set('edit', 'member')
    return `?${params.toString()}`
  }

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
      toast.success(t.deleted(fullName))
      setIsOpen(false)
      setTimeout(() => {
        router.push(`/gym/${gymSlug}/members`)
      }, 120)
    })
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={open => { if (!open) close() }}>
        <DialogContent
          showCloseButton={false}
          className="admin-surface flex max-h-[92vh] text-adm-ink ring-0 max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-[22px] border border-adm-line bg-adm-ground p-0 sm:max-w-3xl lg:max-w-4xl"
        >
          {/* Header */}
          <header className="flex items-start gap-4 border-b border-adm-line bg-adm-surface px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-adm-ok-bg text-lg font-black text-adm-ok-fg sm:h-16 sm:w-16 sm:text-xl">
              {initials(fullName)}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-adm-muted">{t.eyebrow}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                <DialogTitle className="truncate text-2xl font-black leading-tight tracking-[-0.02em] sm:text-[28px]">
                  {fullName}
                </DialogTitle>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                    member.isActive ? 'bg-adm-ok-bg text-adm-ok-fg' : 'bg-adm-chip text-adm-muted'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${member.isActive ? 'bg-[#1fad9d]' : 'bg-zinc-400'}`} />
                  {member.isActive ? t.active : t.inactive}
                </span>
              </div>
              <DialogDescription className="sr-only">{t.a11yDesc(fullName)}</DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-adm-muted">
                <a href={`mailto:${member.email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-adm-ink">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{member.email}</span>
                  </a>
                  {member.phone && (
                    <a href={`tel:${member.phone}`} className="inline-flex items-center gap-1.5 hover:text-adm-ink">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      {member.phone}
                    </a>
                  )}
                  <span>{t.memberSince(formatDate(member.createdAt, intl))}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                href={editHref()}
                aria-label={t.editData}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-adm-line px-3 text-[13px] font-bold transition-colors hover:bg-adm-chip"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t.edit}</span>
              </Link>
              <button
                type="button"
                onClick={close}
                aria-label={t.close}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-adm-line text-adm-muted transition-colors hover:bg-adm-chip hover:text-adm-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Scrollable body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            {/* Summary */}
            <section aria-label={t.summary} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2 rounded-2xl border border-adm-line bg-adm-surface p-4">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-adm-muted">
                  <Ticket className="h-3.5 w-3.5" aria-hidden="true" /> {t.currentPlan}
                </p>
                {activeMembership ? (
                  <>
                    <p className="truncate text-lg font-extrabold leading-tight">{activeMembership.plan?.name ?? 'Plan'}</p>
                    <p className={`text-[13px] font-semibold ${remaining !== null && remaining <= 3 ? 'text-adm-warn-fg' : 'text-adm-muted'}`}>
                      {remaining === 0 ? t.expiresToday : t.expiresIn(remaining ?? 0)} · {formatShort(activeMembership.endDate, intl)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-extrabold leading-tight">{t.noPlan}</p>
                    <p className="text-[13px] text-adm-muted">{t.assignInMembership}</p>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-adm-line bg-adm-surface p-4">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-adm-muted">
                  <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t.visits}
                </p>
                <p className="text-[28px] font-black leading-none tracking-[-0.02em]">{attendance.length}</p>
                <p className="text-[13px] text-adm-muted">{lastVisit ? t.lastVisit(formatShort(lastVisit, intl)) : t.noVisits}</p>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-adm-line bg-adm-surface p-4">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-adm-muted">
                  <CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> {t.paid}
                </p>
                <p className="truncate text-[28px] font-black leading-none tracking-[-0.02em]">
                  {paidTotal.toLocaleString(intl, { style: 'currency', currency, maximumFractionDigits: 0 })}
                </p>
                <p className="text-[13px] text-adm-muted">
                  {lastPayment ? t.lastPayment(formatShort(lastPayment.createdAt, intl)) : t.noPayments}
                </p>
              </div>
            </section>

            {/* Controls */}
            <section aria-label={t.quickActions} className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-adm-line bg-adm-surface p-4">
              <MemberStatusControl memberId={member.id} gymSlug={gymSlug} isActive={member.isActive} />
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-adm-muted">{t.email}</p>
                <ResendWelcomeButton memberId={member.id} />
              </div>
              {walletPass && (
                <div className="w-full border-t border-adm-line-soft pt-4">
                  <WalletPassCard
                    gymSlug={gymSlug}
                    memberId={member.id}
                    memberEmail={member.email}
                    pass={walletPass}
                    canRevoke={canRevokeWallet}
                  />
                </div>
              )}
            </section>

            <MemberTabs
              memberId={member.id}
              gymSlug={gymSlug}
              memberships={memberships}
              payments={payments}
              attendance={attendance}
              plans={plans}
              memberIsActive={member.isActive}
              storeProducts={storeProducts}
              memberCredits={memberCredits}
              candidates={candidates}
              busyIds={new Set(busyIds)}
            />
          </div>

          {canDelete && (
            <footer className="flex items-center border-t border-adm-line bg-adm-surface px-5 py-3 sm:px-7">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={isPending}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold text-adm-bad-fg transition-colors hover:bg-adm-bad-bg disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t.deleteMember}
              </button>
            </footer>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteMember}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteConfirm(fullName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[#ff0000] hover:bg-red-700 text-white"
            >
              {t.deleteMember}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
