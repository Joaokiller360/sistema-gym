import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Users, ChevronRight, Star, Clock, Banknote } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Gym, Member, Plan, Payment } from '@/types'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { GymEditForm } from './GymEditForm'
import { ResendGymWelcomeButton } from './ResendGymWelcomeButton'
import { SubscriptionSection } from './SubscriptionSection'
import type { SubscriptionInfo, BillingRecord } from '../actions'

interface Props {
  params: Promise<{ id: string }>
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default async function GymDetailPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  interface SubscriptionPlan { key: string; price: number | string; currency: string }
  interface PaymentWithMember extends Payment {
    member?: { firstName: string; lastName: string } | null
  }
  interface PaymentsResponse { data: PaymentWithMember[]; total: number }

  const [gym, membersRaw, plansRaw, subscription, billing, subPlans, paymentsRaw] = await Promise.all([
    apiFetch<Gym>(`/admin/gyms/${id}`, token, {
      next: { tags: [`admin-gym-${id}`] },
    }),
    apiFetch<{ data: Member[] } | Member[]>(`/members?gymId=${id}&limit=5`, token),
    apiFetch<{ data: Plan[] } | Plan[]>(`/plans?gymId=${id}`, token),
    apiFetch<SubscriptionInfo>(`/admin/gyms/${id}/subscription`, token, {
      next: { tags: [`admin-gym-${id}-subscription`] },
    }),
    apiFetch<BillingRecord[]>(`/admin/gyms/${id}/billing-history`, token),
    apiFetch<SubscriptionPlan[]>(`/admin/subscription-plans`, token, {
      next: { tags: ['admin-subscription-plans'] },
    }),
    apiFetch<PaymentsResponse | PaymentWithMember[]>(`/payments?gymId=${id}&limit=10`, token),
  ])

  const payments: PaymentWithMember[] = paymentsRaw
    ? (Array.isArray(paymentsRaw) ? paymentsRaw : paymentsRaw.data)
    : []

  if (!gym) notFound()

  const members: Member[] = membersRaw
    ? (Array.isArray(membersRaw) ? membersRaw : membersRaw.data).slice(0, 5)
    : []

  const plans: Plan[] = plansRaw
    ? (Array.isArray(plansRaw) ? plansRaw : plansRaw.data)
    : []

  return (
    <div className="p-6 lg:p-8">
      <Link
        href="/admin/gyms"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-black transition-colors mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver a gimnasios
      </Link>

      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
            {gym.logoUrl
              ? <img src={gym.logoUrl} alt={gym.name} className="h-full w-full object-cover" />
              : <span className="text-xl font-black text-black">{initials(gym.name)}</span>
            }
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{gym.name}</h1>
            <p className="text-zinc-400 text-sm mt-0.5">{gym.slug}</p>
          </div>
          <StatusBadge status={gym.isActive ? 'active' : 'inactive'} />
        </div>

      {/* Info cards */}
      <div className="rounded-2xl border border-zinc-200 bg-white divide-y divide-zinc-100">
        <Row label="ID" value={<span className="font-mono text-xs text-zinc-500">{gym.id}</span>} />
        <Row
          label="Dueño"
          value={
            gym.owner
              ? <div className="text-right">
                <p className="font-semibold text-sm">{gym.owner.name}</p>
                <p className="text-xs text-zinc-400">{gym.owner.email}</p>
              </div>
              : <span className="text-zinc-400">Sin dueño asignado</span>
          }
        />
        <Row label="Plan" value={
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[#fffb00]/40 text-black border border-[#fffb00]">
            {gym.subscriptionPlan ?? '—'}
          </span>
        } />
        {gym.address && <Row label="Dirección" value={gym.address} />}
        {gym.country && <Row label="País" value={`${gym.country}${gym.timezone && gym.timezone !== 'UTC' ? ` · ${gym.timezone}` : ''}`} />}
        <Row label="Creado" value={new Date(gym.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })} />
      </div>

      <div className='flex gap-3 flex-col lg:flex-row'>
        {/* Welcome email */}
        {gym.owner && <ResendGymWelcomeButton gymId={id} />}

        {/* Edit form */}
        <GymEditForm
          gymId={id}
          defaultName={gym.name}
          defaultSlug={gym.slug}
          defaultPlan={gym.subscriptionPlan}
          defaultLogoUrl={gym.logoUrl ?? null}
          ownerName={gym.owner?.name}
          ownerEmail={gym.owner?.email}
          hasOwner={!!gym.owner}
        />
      </div>

      {/* Subscription */}
      {subscription && (() => {
        const matchedPlan = subPlans?.find(p => p.key.toUpperCase() === subscription.subscriptionPlan?.toUpperCase())
        return (
          <SubscriptionSection
            gymId={id}
            gymSlug={gym.slug}
            subscription={subscription}
            billing={billing ?? []}
            planAmount={matchedPlan ? parseFloat(String(matchedPlan.price)) : null}
            planCurrency={matchedPlan?.currency ?? 'USD'}
            subPlans={subPlans ?? []}
          />
        )
      })()}

      {/* Members */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-zinc-400" />
            <h2 className="font-semibold text-sm">Miembros</h2>
            <span className="text-xs text-zinc-400">({members.length})</span>
          </div>
          <Link
            href={`/gym/${gym.slug}/members`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1fad9d] hover:text-[#0e7a70] transition-colors"
          >
            Ver todos <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {members.length === 0 ? (
          <p className="px-5 py-8 text-sm text-zinc-400 text-center">Sin miembros registrados</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {members.map(m => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {m.photoUrl
                    ? <img src={m.photoUrl} alt={`${m.firstName} ${m.lastName}`} className="h-full w-full object-cover" />
                    : <span className="text-xs font-bold text-zinc-500">
                        {m.firstName[0]}{m.lastName[0]}
                      </span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.firstName} {m.lastName}</p>
                  <p className="text-xs text-zinc-400 truncate">{m.email}</p>
                </div>
                <StatusBadge status={m.isActive ? 'active' : 'inactive'} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Plans */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-sm">Planes ofrecidos</h2>
          <span className="text-xs text-zinc-400">{plans.length} plan{plans.length !== 1 ? 'es' : ''}</span>
        </div>
        {plans.length === 0 ? (
          <p className="px-5 py-8 text-sm text-zinc-400 text-center">Sin planes configurados</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {plans.map(p => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{p.name}</p>
                    {p.isFeatured && <Star className="h-3 w-3 text-[#fffb00] fill-[#fffb00]" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock className="h-3 w-3 text-zinc-400" />
                    <span className="text-xs text-zinc-400">{p.durationDays} días</span>
                    {p.daysPerWeek && <span className="text-xs text-zinc-400">· {p.daysPerWeek}x/sem</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{p.currency} {p.price.toLocaleString('es-AR')}</p>
                  <StatusBadge status={p.isActive ? 'active' : 'inactive'} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Payments */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-zinc-400" />
            <h2 className="font-semibold text-sm">Pagos recientes</h2>
          </div>
          <Link
            href={`/gym/${gym.slug}/memberships`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1fad9d] hover:text-[#0e7a70] transition-colors"
          >
            Ver membresías <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {payments.length === 0 ? (
          <p className="px-5 py-8 text-sm text-zinc-400 text-center">Sin pagos registrados</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Miembro</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Monto</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden md:table-cell">Método</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Fecha</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-3">
                    {p.member
                      ? <span className="font-medium">{p.member.firstName} {p.member.lastName}</span>
                      : <span className="font-mono text-xs text-zinc-400">{p.memberId.slice(0, 8)}…</span>
                    }
                  </td>
                  <td className="px-5 py-3 font-semibold">
                    {p.currency} {(Number(p.amount) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 text-zinc-500 hidden md:table-cell">
                    {{ CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', OTHER: 'Otro' }[p.method] ?? p.method}
                  </td>
                  <td className="px-5 py-3 text-zinc-400 hidden lg:table-cell">
                    {new Date(p.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3 text-zinc-400 hidden lg:table-cell">{p.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 text-sm">
      <span className="text-zinc-500 font-medium">{label}</span>
      <span>{value}</span>
    </div>
  )
}
