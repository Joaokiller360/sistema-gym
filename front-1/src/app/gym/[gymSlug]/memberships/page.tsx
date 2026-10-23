import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { MembershipWithRelations, Plan } from '@/types'
import { MembershipsBoard } from './MembershipsBoard'

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ status?: string; planId?: string }>
}

export default async function MembershipsPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { status, planId } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const session = await verifyToken(token)
  const canManage = ['SUPER_ADMIN', 'GYM_OWNER', 'GYM_ADMIN'].includes(session?.role ?? '')

  // Filters run in the browser so the counts always reflect every membership
  const [memberships, plans] = await Promise.all([
    apiFetch<MembershipWithRelations[]>('/memberships', token, {
      next: { tags: [`memberships-${gymSlug}`] },
      headers: { 'x-gym-slug': gymSlug },
    }).then(r => r ?? []),
    apiFetch<Plan[]>('/plans', token, {
      next: { tags: [`plans-${gymSlug}`] },
      headers: { 'x-gym-slug': gymSlug },
    }).then(r => r ?? []),
  ])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <MembershipsBoard
        gymSlug={gymSlug}
        memberships={memberships}
        plans={plans}
        canManage={canManage}
        initialStatus={status}
        initialPlanId={planId}
      />
    </div>
  )
}
