'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MembershipWithRelations, Plan } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  suspendMembershipAction,
  freezeMembershipAction,
  unfreezeMembershipAction,
  cancelMembershipAction,
  changePlanAction,
} from './actions'

interface Props {
  membership: MembershipWithRelations | null
  plans: Plan[]
  gymSlug: string
  open: boolean
  onClose: () => void
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function MembershipModal({ membership, plans, gymSlug, open, onClose }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [changingPlan, setChangingPlan] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')

  function handleClose() {
    setError(null)
    setConfirmCancel(false)
    setChangingPlan(false)
    setSelectedPlanId('')
    onClose()
  }

  function run(action: () => Promise<{ error?: string } | void | null>) {
    setError(null)
    startTransition(async () => {
      try {
        const res = await action()
        if (res && typeof res === 'object' && 'error' in res && res.error) {
          setError(res.error)
        } else {
          router.refresh()
          handleClose()
        }
      } catch {
        setError('Error inesperado. Intentá de nuevo.')
      }
    })
  }

  if (!membership) return null

  const { member, plan, status } = membership
  const initials = `${member.firstName[0] ?? '?'}${member.lastName[0] ?? '?'}`.toUpperCase()
  const availablePlans = plans.filter(p => p.id !== plan.id && p.isActive)
  const today = new Date()
  const daysLeft = Math.ceil(
    (new Date(membership.endDate).getTime() - today.getTime()) / 86_400_000,
  )
  const nearExpiry = status === 'ACTIVE' && daysLeft <= 7 && daysLeft > 0
  const canAct = status === 'ACTIVE' || status === 'FROZEN' || status === 'SUSPENDED'

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar membresía</DialogTitle>
        </DialogHeader>

        {/* Member identity */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1fad9d]/15 text-[#0e7a70] font-bold text-sm select-none">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">
              {member.firstName} {member.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Membership details */}
        <div className="rounded-xl border bg-muted/30 divide-y text-sm">
          <div className="flex justify-between px-3 py-2.5">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">{plan.name}</span>
          </div>
          <div className="flex justify-between px-3 py-2.5">
            <span className="text-muted-foreground">Precio</span>
            <span className="font-medium">
              {plan.currency} {Number(plan.price).toLocaleString('es-AR')}
            </span>
          </div>
          <div className="flex justify-between px-3 py-2.5">
            <span className="text-muted-foreground">Inicio</span>
            <span>{fmt(membership.startDate)}</span>
          </div>
          <div className="flex justify-between px-3 py-2.5">
            <span className="text-muted-foreground">Vencimiento</span>
            <span className={nearExpiry ? 'font-semibold text-amber-600' : ''}>
              {fmt(membership.endDate)}
              {status === 'ACTIVE' && daysLeft > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">({daysLeft}d)</span>
              )}
            </span>
          </div>
          {status === 'FROZEN' && membership.frozenAt && (
            <div className="flex justify-between px-3 py-2.5">
              <span className="text-muted-foreground">Congelado desde</span>
              <span className="text-blue-600">{fmt(membership.frozenAt)}</span>
            </div>
          )}
          {membership.notes && (
            <div className="px-3 py-2.5">
              <span className="text-muted-foreground text-xs">{membership.notes}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        {canAct && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Acciones
            </p>

            {/* Change plan */}
            {status === 'ACTIVE' && availablePlans.length > 0 && (
              <div className="rounded-xl border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setChangingPlan(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  <span>Cambiar plan</span>
                  <svg
                    className={`h-4 w-4 text-muted-foreground transition-transform ${changingPlan ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {changingPlan && (
                  <div className="border-t px-3 py-3 bg-muted/20 flex gap-2">
                    <select
                      value={selectedPlanId}
                      onChange={e => setSelectedPlanId(e.target.value)}
                      className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Seleccionar plan…</option>
                      {availablePlans.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.currency} {Number(p.price).toLocaleString('es-AR')}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedPlanId || isPending}
                      onClick={() => run(() => changePlanAction(gymSlug, membership.id, selectedPlanId))}
                      className="shrink-0 rounded-lg bg-[#1fad9d] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0e7a70] disabled:opacity-50 transition-colors"
                    >
                      {isPending ? '…' : 'Confirmar'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-2">
              {status === 'ACTIVE' && (
                <>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => freezeMembershipAction(gymSlug, membership.id))}
                    className="flex-1 min-w-[100px] rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    Congelar
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => suspendMembershipAction(gymSlug, membership.id))}
                    className="flex-1 min-w-[100px] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                  >
                    Suspender
                  </button>
                </>
              )}
              {status === 'FROZEN' && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => unfreezeMembershipAction(gymSlug, membership.id))}
                  className="flex-1 rounded-lg border border-[#1fad9d]/30 bg-[#1fad9d]/10 px-3 py-2.5 text-xs font-semibold text-[#0e7a70] hover:bg-[#1fad9d]/20 disabled:opacity-50 transition-colors"
                >
                  Descongelar
                </button>
              )}
            </div>

            {/* Cancel — with inline confirmation */}
            {!confirmCancel ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmCancel(true)}
                className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                Cancelar membresía
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2.5">
                <p className="text-xs font-semibold text-red-700">
                  ¿Confirmar cancelación? Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    No, volver
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => cancelMembershipAction(gymSlug, membership.id))}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? '…' : 'Sí, cancelar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
