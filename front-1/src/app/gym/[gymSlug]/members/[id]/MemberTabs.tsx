'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MessageSquare, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { MembershipWithRelations, Payment, Attendance, MembershipStatus, Plan } from '@/types'
import { AssignPlanForm } from './AssignPlanForm'
import { SharedPlanBlock } from './SharedPlanBlock'
import type { CompanionCandidate } from './CompanionPicker'
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

// Segmented-pill trigger; overrides the base tab styles
const TAB =
  'h-9 flex-none rounded-[9px] border-0 px-3.5 text-[13px] font-bold text-adm-muted hover:text-adm-ink data-active:bg-adm-ink data-active:text-adm-surface dark:data-active:bg-adm-ink dark:data-active:text-adm-surface dark:data-active:border-transparent after:hidden'

const EMPTY = 'rounded-2xl border border-dashed border-adm-line py-10 text-center text-sm text-adm-muted'

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
  /** Members that can be added as companions on shared plans */
  candidates?: CompanionCandidate[]
  busyIds?: Set<string>
}

export function MemberTabs({ memberId, gymSlug, memberships, payments, attendance, plans, memberIsActive = true, storeProducts = [], memberCredits = [], candidates = [], busyIds }: MemberTabsProps) {
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
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <TabsList className="h-auto gap-1 rounded-xl border border-adm-line bg-adm-surface p-1 group-data-horizontal/tabs:h-auto">
        <TabsTrigger value="membership" className={TAB}>Membresía</TabsTrigger>
        <TabsTrigger value="payments" className={TAB}>
          Pagos {payments.length > 0 && <span className="font-admin-mono text-xs opacity-60">{payments.length}</span>}
        </TabsTrigger>
        <TabsTrigger value="attendance" className={TAB}>
          Asistencia {attendance.length > 0 && <span className="font-admin-mono text-xs opacity-60">{attendance.length}</span>}
        </TabsTrigger>
        <TabsTrigger value="credits" className={TAB}>
          Créditos
          {memberCredits.filter(c => !c.isPaid).length > 0 && (
            <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-black">
              {memberCredits.filter(c => !c.isPaid).length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="communications" className={TAB}>Comunicaciones</TabsTrigger>
      </TabsList>
      </div>

      {/* ── Membresía ─────────────────────────────────────── */}
      <TabsContent value="membership" className="mt-4 space-y-4">
        {activeMembership ? (
          <div className="space-y-3 rounded-2xl border border-adm-ok-line bg-adm-ok-bg/50 p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-lg font-black">{activeMembership.plan?.name ?? 'Plan'}</p>
                <p className="text-xs text-adm-muted mt-0.5">
                  {formatDate(activeMembership.startDate)} → {formatDate(activeMembership.endDate)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={activeMembership.status as MembershipStatus} />
                <button
                  type="button"
                  onClick={() => setConfirmCancelMembership(true)}
                  disabled={isPendingCancel}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-adm-bad-line bg-adm-surface px-3 text-xs font-bold text-adm-bad-fg transition-colors hover:bg-adm-bad-bg disabled:opacity-40"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancelar plan
                </button>
              </div>
            </div>

            {activeMembership.visitsTotal != null ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-3xl font-black text-adm-ok-fg">
                      {Math.max(0, activeMembership.visitsTotal - activeMembership.visitsUsed)}
                    </span>
                    <span className="text-sm text-adm-muted ml-1">
                      de {activeMembership.visitsTotal} días de entreno restantes
                    </span>
                  </div>
                  <span className="text-xs text-adm-muted">
                    Vence en {daysLeft(activeMembership.endDate)} días
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-adm-surface"
                  role="progressbar"
                  aria-label="Días de entreno usados"
                  aria-valuemin={0}
                  aria-valuemax={activeMembership.visitsTotal}
                  aria-valuenow={activeMembership.visitsUsed}
                >
                  <div
                    className="h-full rounded-full bg-[#1fad9d]"
                    style={{ width: `${Math.min(100, (activeMembership.visitsUsed / activeMembership.visitsTotal) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-adm-muted">
                  {activeMembership.visitsUsed} usados · cada día que entrena descuenta uno
                </p>
              </div>
            ) : (
              <div>
                <span className="text-3xl font-black text-adm-ok-fg">
                  {daysLeft(activeMembership.endDate)}
                </span>
                <span className="text-sm text-adm-muted ml-1">días restantes</span>
              </div>
            )}

            {activeMembership.plan && (
              <p className="text-sm text-adm-muted">
                {activeMembership.plan.price.toLocaleString('es-AR', {
                  style: 'currency',
                  currency: activeMembership.plan.currency,
                })}{' '}
                / {activeMembership.plan.durationDays} días
                {activeMembership.visitsTotal != null
                  ? ` · ${activeMembership.visitsTotal} días de entreno`
                  : activeMembership.plan.daysPerWeek !== null
                    ? ` · ${activeMembership.plan.daysPerWeek} veces/semana`
                    : ' · Acceso ilimitado'}
                {activeMembership.plan.maxMembers > 1 && ` · Para ${activeMembership.plan.maxMembers} personas`}
              </p>
            )}

            {activeMembership.groupId && (activeMembership.plan?.maxMembers ?? 1) > 1 && (
              <SharedPlanBlock
                gymSlug={gymSlug}
                membership={activeMembership}
                candidates={candidates}
                busyIds={busyIds}
              />
            )}
          </div>
        ) : (
          <div className={EMPTY}>
            Sin membresía activa
          </div>
        )}

        {memberIsActive && (
          <AssignPlanForm
            memberId={memberId}
            gymSlug={gymSlug}
            plans={plans}
            activeMembershipId={activeMembership?.id}
            candidates={candidates}
            busyIds={busyIds}
          />
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
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-adm-muted">Historial</p>
            <div className="divide-y divide-adm-line-soft overflow-hidden rounded-2xl border border-adm-line bg-adm-surface">
              {pastMemberships.map(m => (
                <div key={m.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
                  <div>
                    <p className="font-semibold">{m.plan?.name ?? 'Plan'}</p>
                    <p className="text-xs text-adm-muted">
                      {formatDate(m.startDate)} → {formatDate(m.endDate)}
                      {m.visitsTotal != null && ` · ${m.visitsUsed}/${m.visitsTotal} días usados`}
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
          <div className={EMPTY}>
            Sin pagos registrados
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-adm-line bg-adm-surface">
            <table className="w-full text-sm">
              <thead className="border-b border-adm-line bg-adm-subtle">
                <tr>
                  <th className="text-left px-3 sm:px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-adm-muted">Fecha</th>
                  <th className="text-left px-3 sm:px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-adm-muted hidden sm:table-cell">Notas</th>
                  <th className="text-left px-3 sm:px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-adm-muted">Método</th>
                  <th className="text-right px-3 sm:px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-adm-muted">Monto</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-adm-line-soft">
                {payments.map(p => (
                  <tr key={p.id} className={`hover:bg-adm-subtle ${deletingId === p.id ? 'opacity-50' : ''}`}>
                    <td className="px-3 sm:px-5 py-3.5 font-admin-mono text-[13px]">{formatDate(p.createdAt)}</td>
                    <td className="px-3 sm:px-5 py-3.5 text-adm-muted hidden sm:table-cell">{p.notes ?? '—'}</td>
                    <td className="px-3 sm:px-5 py-3.5 text-adm-muted">{METHOD_LABELS[p.method] ?? p.method}</td>
                    <td className="px-3 sm:px-5 py-3.5 font-bold text-right">
                      {parseFloat(String(p.amount)).toLocaleString('es-AR', { style: 'currency', currency: p.currency })}
                    </td>
                    <td className="px-3 py-3.5">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(p.id)}
                        disabled={isPendingDelete}
                        className="flex h-9 w-9 items-center justify-center rounded-[10px] text-adm-muted transition-colors hover:bg-adm-bad-bg hover:text-adm-bad-fg disabled:opacity-40"
                        aria-label="Eliminar pago"
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
          <div className={EMPTY}>
            Sin registros de asistencia
          </div>
        ) : (
          <>
            <p className="text-xs text-adm-muted">
              {attendance.length} visita{attendance.length !== 1 ? 's' : ''} registrada{attendance.length !== 1 ? 's' : ''}
            </p>
            <div className="divide-y divide-adm-line-soft overflow-hidden rounded-2xl border border-adm-line bg-adm-surface">
              {attendance.map(a => {
                const dur = durationStr(a.checkIn, a.checkOut ?? undefined)
                return (
                  <div key={a.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
                    <div>
                      <p className="font-admin-mono text-[13px] font-semibold">{formatDate(a.checkIn)}</p>
                      <p className="text-xs text-adm-muted">
                        {formatTime(a.checkIn)}
                        {a.checkOut && ` → ${formatTime(a.checkOut)}`}
                        {dur && <span className="ml-2 font-semibold text-adm-ok-fg">({dur})</span>}
                      </p>
                    </div>
                    {!a.checkOut && (
                      <span className="rounded-full bg-adm-ok-bg px-2.5 py-1 text-xs font-bold text-adm-ok-fg">
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
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-adm-line py-16 text-center">
          <MessageSquare className="h-10 w-10 text-adm-line" aria-hidden="true" />
          <p className="text-sm text-adm-muted">Módulo de comunicaciones próximamente</p>
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
