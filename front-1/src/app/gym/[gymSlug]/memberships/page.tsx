import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { MembershipWithRelations, Plan } from '@/types'
import { MembershipsClient } from './MembershipsClient'

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ status?: string; planId?: string }>
}

export default async function MembershipsPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { status, planId } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const qs = new URLSearchParams()
  if (status) qs.set('status', status)
  if (planId) qs.set('planId', planId)

  const [memberships, plans] = await Promise.all([
    apiFetch<MembershipWithRelations[]>(
      `/memberships?${qs.toString()}`,
      token,
      { next: { tags: [`memberships-${gymSlug}`] }, headers: { 'x-gym-slug': gymSlug } },
    ).then(r => r ?? []),
    apiFetch<Plan[]>('/plans', token, {
      next: { tags: [`plans-${gymSlug}`] },
      headers: { 'x-gym-slug': gymSlug },
    }).then(r => r ?? []),
  ])

  const counts = {
    ACTIVE: memberships.filter(m => m.status === 'ACTIVE').length,
    EXPIRED: memberships.filter(m => m.status === 'EXPIRED').length,
    FROZEN: memberships.filter(m => m.status === 'FROZEN').length,
    SUSPENDED: memberships.filter(m => m.status === 'SUSPENDED').length,
  }

  const activePlans = plans.filter(p => p.isActive)

  const STATUSES = [
    { value: '', label: 'Todos' },
    { value: 'ACTIVE', label: 'Activos' },
    { value: 'EXPIRED', label: 'Vencidos' },
    { value: 'SUSPENDED', label: 'Suspendidos' },
    { value: 'FROZEN', label: 'Congelados' },
    { value: 'CANCELLED', label: 'Cancelados' },
  ]

  function href(newStatus: string | undefined, newPlanId: string | undefined) {
    const p = new URLSearchParams()
    const s = newStatus !== undefined ? newStatus : (status ?? '')
    const pid = newPlanId !== undefined ? newPlanId : (planId ?? '')
    if (s) p.set('status', s)
    if (pid) p.set('planId', pid)
    const str = p.toString()
    return str ? `?${str}` : '?'
  }

  const filterPill = (active: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-border hover:bg-muted text-muted-foreground'
    }`

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight">Membresías</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {memberships.length} membresía{memberships.length !== 1 ? 's' : ''}
          {planId && activePlans.find(p => p.id === planId)
            ? ` · ${activePlans.find(p => p.id === planId)!.name}`
            : ''}
          {status ? ` · ${STATUSES.find(s => s.value === status)?.label}` : ''}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#1fad9d]/25 bg-[#1fad9d]/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0e7a70] mb-1">Activas</p>
          <p className="text-3xl font-black text-[#1fad9d]">{counts.ACTIVE}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-1">Vencidas</p>
          <p className="text-3xl font-black text-red-500">{counts.EXPIRED}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-1">Congeladas</p>
          <p className="text-3xl font-black text-blue-500">{counts.FROZEN}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-500 mb-1">Suspendidas</p>
          <p className="text-3xl font-black text-amber-500">{counts.SUSPENDED}</p>
        </div>
      </div>

      {/* Plan filter */}
      {activePlans.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Por plan
          </p>
          <div className="flex gap-1.5 flex-wrap">
            <a href={href(undefined, '')} className={filterPill(!planId)}>
              Todos los planes
            </a>
            {activePlans.map(p => (
              <a key={p.id} href={href(undefined, p.id)} className={filterPill(planId === p.id)}>
                {p.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Por estado
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map(({ value, label }) => (
            <a
              key={value}
              href={href(value, undefined)}
              className={filterPill((status ?? '') === value)}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* Table */}
      <MembershipsClient
        memberships={memberships}
        plans={plans}
        gymSlug={gymSlug}
      />
    </div>
  )
}
