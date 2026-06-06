'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MessageSquare, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { MembershipWithRelations, Payment, Attendance, MembershipStatus, Plan } from '@/types'
import { AssignPlanForm } from './AssignPlanForm'
import { ChangePlanForm } from './ChangePlanForm'
import { RegisterPaymentForm } from './RegisterPaymentForm'
import { MemberCredits } from './MemberCredits'
import { deletePaymentAction } from './actions'
import { cancelMembershipWithPaymentsAction } from '../../memberships/actions'
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function daysLeft(endDate: string) {
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000))
}

function durationStr(checkIn: string, checkOut?: string) {
  if (!checkOut) return null
  const mins = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60_000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
}

interface Product {
  id: string; name: string; price: number; stock: number; category: string | null; isActive: boolean
}
interface Credit {
  id: string; productId: string; quantity: number; unitPrice: number; isPaid: boolean; paidAt: string | null
  notes: string | null; createdAt: string; product: { name: string; price: number }
}

interface MemberTabsProps {
  memberId: string
  gymSlug: string
  memberships: MembershipWithRelations[]
  payments: Payment[]
  attendance: Attendance[]
  plans: Plan[]
  memberIsActive?: boolean
  storeProducts?: Product[]
  memberCredits?: Credit[]
}

export function MemberTabs({ memberId, gymSlug, memberships, payments, attendance, plans, memberIsActive = true, storeProducts = [], memberCredits = [] }: MemberTabsProps) {
  const router = useRouter()
  const activeMembership = memberships.find(m => m.status === 'ACTIVE')
  const pastMemberships = memberships.filter(m => m.status !== 'ACTIVE')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPendingDelete, startDeleteTransition] = useTransition()
  const [confirmCancelMembership, setConfirmCancelMembership] = useState(false)
  const [isPendingCancel, startCancelTransition] = useTransition()

  function confirmDeletePayment() {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setConfirmDeleteId(null)
    setDeletingId(id)
    startDeleteTransition(async () => {
      await deletePaymentAction(gymSlug, memberId, id)
      setDeletingId(null)
      router.refresh()
    })
  }

  function handleCancelMembership() {
    if (!activeMembership) return
    setConfirmCancelMembership(false)
    startCancelTransition(async () => {
      const result = await cancelMembershipWithPaymentsAction(gymSlug, activeMembership.id, memberId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Membresía cancelada correctamente')
        router.refresh()
      }
    })
  }

  return (
    <Tabs defaultValue="membership">
      <div className="overflow-x-auto">
      <TabsList variant="line">
        <TabsTrigger value="membership">Membresía</TabsTrigger>
        <TabsTrigger value="payments">Pagos</TabsTrigger>
        <TabsTrigger value="attendance">Asistencia</TabsTrigger>
        <TabsTrigger value="credits">
          Créditos
          {memberCredits.filter(c => !c.isPaid).length > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-400 text-black text-[10px] font-black px-1.5 py-0.5">
              {memberCredits.filter(c => !c.isPaid).length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="communications">Comunicaciones</TabsTrigger>
      </TabsList>
      </div>

      {/* ── Membresía ─────────────────────────────────────── */}
      <TabsContent value="membership" className="mt-4 space-y-4">
        {activeMembership ? (
          <div className="rounded-2xl border-2 border-[#1fad9d]/30 bg-[#1fad9d]/5 p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-black text-base">{activeMembership.plan?.name ?? 'Plan'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(activeMembership.startDate)} → {formatDate(activeMembership.endDate)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={activeMembership.status as MembershipStatus} />
                <button
                  type="button"
                  onClick={() => setConfirmCancelMembership(true)}
                  disabled={isPendingCancel}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-[#ff0000] hover:bg-red-50 transition-all disabled:opacity-40"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancelar plan
                </button>
              </div>
            </div>

            <div>
              <span className="text-3xl font-black text-[#1fad9d]">
                {daysLeft(activeMembership.endDate)}
              </span>
              <span className="text-sm text-muted-foreground ml-1">días restantes</span>
            </div>

            {activeMembership.plan && (
              <p className="text-sm text-muted-foreground">
                {activeMembership.plan.price.toLocaleString('es-AR', {
                  style: 'currency',
                  currency: activeMembership.plan.currency,
                })}{' '}
                / {activeMembership.plan.durationDays} días
                {activeMembership.plan.daysPerWeek !== null
                  ? ` · ${activeMembership.plan.daysPerWeek} veces/semana`
                  : ' · Acceso ilimitado'}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-10 text-center text-sm text-muted-foreground">
            Sin membresía activa
          </div>
        )}

        {memberIsActive && (
          <AssignPlanForm memberId={memberId} gymSlug={gymSlug} plans={plans} activeMembershipId={activeMembership?.id} />
        )}

        {/* Change plan (only when there's an active membership) */}
        {activeMembership && (
          <ChangePlanForm
            memberId={memberId}
            gymSlug={gymSlug}
            membershipId={activeMembership.id}
            currentPlanId={activeMembership.plan?.id}
            plans={plans}
          />
        )}

        {pastMemberships.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Historial</p>
            <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white divide-y divide-zinc-100">
              {pastMemberships.map(m => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
                  <div>
                    <p className="font-semibold">{m.plan?.name ?? 'Plan'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(m.startDate)} → {formatDate(m.endDate)}
                    </p>
                  </div>
                  <StatusBadge status={m.status as MembershipStatus} />
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      {/* ── Pagos ────────────────────────────────────────── */}
      <TabsContent value="payments" className="mt-4 space-y-4">
        <RegisterPaymentForm
          memberId={memberId}
          gymSlug={gymSlug}
          membershipId={activeMembership?.id}
        />
        {payments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-10 text-center text-sm text-muted-foreground">
            Sin pagos registrados
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Fecha</th>
                  <th className="text-left px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Notas</th>
                  <th className="text-left px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Método</th>
                  <th className="text-right px-3 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Monto</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.map(p => (
                  <tr key={p.id} className={`hover:bg-zinc-50 ${deletingId === p.id ? 'opacity-50' : ''}`}>
                    <td className="px-3 sm:px-5 py-3.5">{formatDate(p.createdAt)}</td>
                    <td className="px-3 sm:px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{p.notes ?? '—'}</td>
                    <td className="px-3 sm:px-5 py-3.5 text-muted-foreground">{METHOD_LABELS[p.method] ?? p.method}</td>
                    <td className="px-3 sm:px-5 py-3.5 font-bold text-right">
                      {parseFloat(String(p.amount)).toLocaleString('es-AR', { style: 'currency', currency: p.currency })}
                    </td>
                    <td className="px-3 py-3.5">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(p.id)}
                        disabled={isPendingDelete}
                        className="p-1.5 rounded-lg text-zinc-300 hover:text-[#ff0000] hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Eliminar pago"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AlertDialog open={!!confirmDeleteId} onOpenChange={open => { if (!open) setConfirmDeleteId(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar pago</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que querés eliminar este pago? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeletePayment}
                className="bg-[#ff0000] hover:bg-red-700 text-white"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </TabsContent>

      {/* ── Asistencia ───────────────────────────────────── */}
      <TabsContent value="attendance" className="mt-4 space-y-3">
        {attendance.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 py-10 text-center text-sm text-muted-foreground">
            Sin registros de asistencia
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {attendance.length} visita{attendance.length !== 1 ? 's' : ''} registrada{attendance.length !== 1 ? 's' : ''}
            </p>
            <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white divide-y divide-zinc-100">
              {attendance.map(a => {
                const dur = durationStr(a.checkIn, a.checkOut ?? undefined)
                return (
                  <div key={a.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
                    <div>
                      <p className="font-semibold">{formatDate(a.checkIn)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(a.checkIn)}
                        {a.checkOut && ` → ${formatTime(a.checkOut)}`}
                        {dur && <span className="ml-2 text-[#1fad9d] font-semibold">({dur})</span>}
                      </p>
                    </div>
                    {!a.checkOut && (
                      <span className="text-xs text-[#1fad9d] font-bold bg-[#1fad9d]/10 px-2.5 py-1 rounded-full">
                        Asistido
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </TabsContent>

      {/* ── Créditos tienda ──────────────────────────────── */}
      <TabsContent value="credits" className="mt-4">
        <MemberCredits
          gymSlug={gymSlug}
          memberId={memberId}
          products={storeProducts}
          credits={memberCredits}
        />
      </TabsContent>

      {/* ── Comunicaciones ───────────────────────────────── */}
      <TabsContent value="communications" className="mt-4">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 py-16 text-center gap-3">
          <MessageSquare className="h-10 w-10 text-zinc-300" />
          <p className="text-sm text-muted-foreground">Módulo de comunicaciones próximamente</p>
        </div>
      </TabsContent>

      <AlertDialog open={confirmCancelMembership} onOpenChange={setConfirmCancelMembership}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar membresía</AlertDialogTitle>
            <AlertDialogDescription>
              Se cancelará el plan activo del miembro. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelMembership}
              className="bg-[#ff0000] hover:bg-red-700 text-white"
            >
              Cancelar plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  )
}
