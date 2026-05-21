import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { MembershipWithRelations } from '@/types'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MembershipActions } from './MembershipActions'

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ status?: string }>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function MembershipsPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { status } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const qs = new URLSearchParams()
  if (status) qs.set('status', status)

  const memberships = await apiFetch<MembershipWithRelations[]>(
    `/memberships?${qs.toString()}`,
    token,
    { next: { tags: [`memberships-${gymSlug}`] } },
  ) ?? []

  const STATUSES = [
    { value: '', label: 'Todos' },
    { value: 'ACTIVE', label: 'Activos' },
    { value: 'EXPIRED', label: 'Vencidos' },
    { value: 'SUSPENDED', label: 'Suspendidos' },
    { value: 'FROZEN', label: 'Congelados' },
    { value: 'CANCELLED', label: 'Cancelados' },
  ]

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Membresías</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {memberships.length} membresía{memberships.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex gap-1 flex-wrap">
        {STATUSES.map(({ value, label }) => {
          const active = (status ?? '') === value
          return (
            <a
              key={value}
              href={`?${value ? `status=${value}` : ''}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              {label}
            </a>
          )
        })}
      </div>

      {memberships.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-20">
          <p className="text-muted-foreground text-sm">Sin membresías en esta categoría</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Miembro</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Inicio</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vence</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {memberships.map(m => (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    {m.member.firstName} {m.member.lastName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.plan.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(m.startDate)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(m.endDate)}</td>
                  <td className="px-4 py-3 text-right">
                    <MembershipActions membershipId={m.id} status={m.status} gymSlug={gymSlug} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
