import { Suspense, type ComponentProps } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { Member, MembershipWithRelations, Payment, Attendance, Plan } from '@/types'
import { MembersBoard } from './MembersBoard'
import { MemberModal } from './MemberModal'
import { NewMemberModal } from './NewMemberModal'
import { NewPaymentModal } from './NewPaymentModal'
import { EditMemberModal } from './[id]/EditMemberModal'
import type { WalletPassInfo } from './[id]/wallet-actions'
import type { MemberRow } from './memberStatus'

interface MembersResponse {
  data: MemberRow[]
  total: number
}

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ q?: string; member?: string; new?: string; payFor?: string; edit?: string }>
}

export default async function MembersPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { q, member: rawMemberId, new: newParam, payFor: rawPayFor, edit } = await searchParams
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const selectedMemberId = rawMemberId && UUID_RE.test(rawMemberId) ? rawMemberId : undefined
  const payForId = rawPayFor && UUID_RE.test(rawPayFor) ? rawPayFor : undefined

  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const session = await verifyToken(token)
  const canDelete = session?.role === 'SUPER_ADMIN' || session?.role === 'GYM_OWNER'
  const canRevokeWallet = ['SUPER_ADMIN', 'GYM_OWNER', 'GYM_ADMIN'].includes(session?.role ?? '')

  // The board searches and filters client-side over every member (counts per status need the full set)
  const currentParams = new URLSearchParams()
  if (q) currentParams.set('q', q)

  const newMemberHref = `?${new URLSearchParams({ ...Object.fromEntries(currentParams), new: 'member' }).toString()}`
  const newPaymentHref = `?${new URLSearchParams({ ...Object.fromEntries(currentParams), new: 'payment' }).toString()}`

  const raw = await apiFetch<MembersResponse | MemberRow[]>(
    `/members`,
    token,
    { next: { tags: [`members-${gymSlug}`] }, headers: { 'x-gym-slug': gymSlug } },
  )

  const members: MemberRow[] = raw
    ? Array.isArray(raw) ? raw : raw.data
    : []

  // Fetch data for member profile modal
  let selectedMember: Member | null = null
  let memberships: MembershipWithRelations[] = []
  let payments: Payment[] = []
  let attendance: Attendance[] = []
  let memberPlans: Plan[] = []
  let walletPass: WalletPassInfo | null = null
  let storeProducts: ComponentProps<typeof MemberModal>['storeProducts'] = []
  let memberCredits: ComponentProps<typeof MemberModal>['memberCredits'] = []

  if (selectedMemberId) {
    const [member, mbs, pays, att, pls, products, credits, pass] = await Promise.all([
      apiFetch<Member>(`/members/${selectedMemberId}`, token, {
        silent: true,
        next: { tags: [`member-${selectedMemberId}`] },
        headers: { 'x-gym-slug': gymSlug },
      }),
      apiFetch<MembershipWithRelations[]>(`/memberships?memberId=${selectedMemberId}`, token, {
        next: { tags: [`member-${selectedMemberId}-memberships`] },
        headers: { 'x-gym-slug': gymSlug },
      }),
      apiFetch<Payment[]>(`/payments?memberId=${selectedMemberId}`, token, {
        next: { tags: [`member-${selectedMemberId}-payments`] },
        headers: { 'x-gym-slug': gymSlug },
      }),
      apiFetch<Attendance[]>(`/attendance?memberId=${selectedMemberId}`, token, {
        next: { tags: [`member-${selectedMemberId}-attendance`] },
        headers: { 'x-gym-slug': gymSlug },
      }),
      apiFetch<Plan[]>(`/plans`, token, { headers: { 'x-gym-slug': gymSlug } }),
      apiFetch<typeof storeProducts>('/store/products', token, {
        next: { tags: [`store-products-${gymSlug}`] }, headers: { 'x-gym-slug': gymSlug }, silent: true,
      }),
      apiFetch<typeof memberCredits>(`/store/credits/${selectedMemberId}`, token, {
        cache: 'no-store', headers: { 'x-gym-slug': gymSlug }, silent: true,
      }),
      apiFetch<WalletPassInfo>(`/wallet/members/${selectedMemberId}/pass`, token, {
        next: { tags: [`member-${selectedMemberId}-wallet`] }, headers: { 'x-gym-slug': gymSlug }, silent: true,
      }),
    ])
    if (!member) {
      redirect(`/gym/${gymSlug}/members?${currentParams.toString()}`)
    }
    selectedMember = member
    memberships = mbs ?? []
    payments = pays ?? []
    attendance = att ?? []
    memberPlans = pls ?? []
    storeProducts = products ?? []
    memberCredits = credits ?? []
    walletPass = pass ?? null
  }

  // Fetch data for payment modal
  let paymentMembers: Member[] = []
  let paymentPlans: Plan[] = []

  if (newParam === 'payment') {
    const plans = await apiFetch<Plan[]>(`/plans`, token, { headers: { 'x-gym-slug': gymSlug } })
    paymentMembers = members
    paymentPlans = (plans ?? []).filter(p => p.isActive)
  }

  return (
    <div className="p-6 lg:p-8">
      <MembersBoard
        members={members}
        gymSlug={gymSlug}
        paramsString={currentParams.toString()}
        newMemberHref={newMemberHref}
        newPaymentHref={newPaymentHref}
        initialQuery={q ?? ''}
      />

      {selectedMember && edit === 'member' && (
        <Suspense>
          <EditMemberModal gymSlug={gymSlug} member={selectedMember} />
        </Suspense>
      )}

      {selectedMember && edit !== 'member' && (
        <Suspense>
          <MemberModal
            member={selectedMember}
            memberships={memberships}
            payments={payments}
            attendance={attendance}
            plans={memberPlans}
            gymSlug={gymSlug}
            canDelete={canDelete}
            canRevokeWallet={canRevokeWallet}
            walletPass={walletPass}
            storeProducts={storeProducts}
            memberCredits={memberCredits}
            candidates={members}
            busyIds={members.filter(m => m.memberships?.some(ms => ms.status === 'ACTIVE')).map(m => m.id)}
          />
        </Suspense>
      )}

      {newParam === 'member' && (
        <Suspense>
          <NewMemberModal gymSlug={gymSlug} />
        </Suspense>
      )}

      {newParam === 'payment' && (
        <Suspense>
          <NewPaymentModal gymSlug={gymSlug} members={paymentMembers} plans={paymentPlans} initialMemberId={payForId} />
        </Suspense>
      )}
    </div>
  )
}
