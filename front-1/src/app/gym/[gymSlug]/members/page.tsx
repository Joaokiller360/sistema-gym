import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { Member, MembershipWithRelations, Payment, Attendance, Plan } from '@/types'
import { MembersTable } from './MembersTable'
import { SearchInput } from './SearchInput'
import { MemberModal } from './MemberModal'
import { NewMemberModal } from './NewMemberModal'
import { NewPaymentModal } from './NewPaymentModal'

const LIMIT = 25

interface MembersResponse {
  data: Member[]
  total: number
}

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ q?: string; status?: string; page?: string; member?: string; new?: string }>
}

export default async function MembersPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { q, status, page: pageStr, member: rawMemberId, new: newParam } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const selectedMemberId = rawMemberId && UUID_RE.test(rawMemberId) ? rawMemberId : undefined

  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const session = await verifyToken(token)
  const canDelete = session?.role === 'SUPER_ADMIN' || session?.role === 'GYM_OWNER'

  const qs = new URLSearchParams()
  if (q) qs.set('search', q)
  if (status) qs.set('status', status)
  qs.set('page', String(page))
  qs.set('limit', String(LIMIT))

  const currentParams = new URLSearchParams()
  if (q) currentParams.set('q', q)
  if (status) currentParams.set('status', status)
  if (page > 1) currentParams.set('page', String(page))

  const newMemberHref = `?${new URLSearchParams({ ...Object.fromEntries(currentParams), new: 'member' }).toString()}`
  const newPaymentHref = `?${new URLSearchParams({ ...Object.fromEntries(currentParams), new: 'payment' }).toString()}`

  const raw = await apiFetch<MembersResponse | Member[]>(
    `/members?${qs.toString()}`,
    token,
    { next: { tags: [`members-${gymSlug}`] }, headers: { 'x-gym-slug': gymSlug } },
  )

  const members: Member[] = raw
    ? Array.isArray(raw) ? raw : raw.data
    : []

  const total: number = raw
    ? Array.isArray(raw) ? raw.length : raw.total
    : 0

  const STATUSES = [
    { value: '', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
  ]

  // Fetch data for member profile modal
  let selectedMember: Member | null = null
  let memberships: MembershipWithRelations[] = []
  let payments: Payment[] = []
  let attendance: Attendance[] = []
  let memberPlans: Plan[] = []

  if (selectedMemberId) {
    const [member, mbs, pays, att, pls] = await Promise.all([
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
    ])
    if (!member) {
      redirect(`/gym/${gymSlug}/members?${currentParams.toString()}`)
    }
    selectedMember = member
    memberships = mbs ?? []
    payments = pays ?? []
    attendance = att ?? []
    memberPlans = pls ?? []
  }

  // Fetch data for payment modal
  let paymentMembers: Member[] = []
  let paymentPlans: Plan[] = []

  if (newParam === 'payment') {
    const [membersRaw, plans] = await Promise.all([
      apiFetch<MembersResponse | Member[]>(`/members?limit=200`, token, {
        next: { tags: [`members-${gymSlug}`] },
        headers: { 'x-gym-slug': gymSlug },
      }),
      apiFetch<Plan[]>(`/plans`, token, { headers: { 'x-gym-slug': gymSlug } }),
    ])
    paymentMembers = membersRaw
      ? Array.isArray(membersRaw) ? membersRaw : membersRaw.data
      : []
    paymentPlans = (plans ?? []).filter(p => p.isActive)
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Miembros</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total > 0 ? `${total} miembro${total !== 1 ? 's' : ''}` : 'Sin miembros registrados'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={newPaymentHref}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-bold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-all active:scale-[0.98]"
          >
            Registrar pago
          </a>
          <a
            href={newMemberHref}
            className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-all active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Nuevo miembro
          </a>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Suspense>
          <SearchInput defaultValue={q} />
        </Suspense>

        <div className="flex gap-1">
          {STATUSES.map(({ value, label }) => {
            const active = (status ?? '') === value
            return (
              <a
                key={value}
                href={`?${new URLSearchParams({ ...(q ? { q } : {}), ...(value ? { status: value } : {}) }).toString()}`}
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
      </div>

      <MembersTable members={members} gymSlug={gymSlug} paramsString={currentParams.toString()} />

      {selectedMember && (
        <Suspense>
          <MemberModal
            member={selectedMember}
            memberships={memberships}
            payments={payments}
            attendance={attendance}
            plans={memberPlans}
            gymSlug={gymSlug}
            canDelete={canDelete}
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
          <NewPaymentModal gymSlug={gymSlug} members={paymentMembers} plans={paymentPlans} />
        </Suspense>
      )}
    </div>
  )
}
