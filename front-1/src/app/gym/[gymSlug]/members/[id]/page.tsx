import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { ChevronLeft, Mail, Phone, Pencil } from 'lucide-react'
import { Suspense } from 'react'
import { apiFetch } from '@/lib/api'
import { Member, MembershipWithRelations, Payment, Attendance, Plan } from '@/types'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Separator } from '@/components/ui/separator'
import { MemberTabs } from './MemberTabs'
import { MemberStatusControl } from './MemberStatusControl'
import { ResendWelcomeButton } from './ResendWelcomeButton'
import { EditMemberModal } from './EditMemberModal'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface Props {
  params: Promise<{ gymSlug: string; id: string }>
  searchParams: Promise<{ edit?: string }>
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default async function MemberDetailPage({ params, searchParams }: Props) {
  const { gymSlug, id } = await params
  const { edit } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const [member, memberships, payments, attendance, plans, storeProducts, memberCredits] = await Promise.all([
    apiFetch<Member>(`/members/${id}`, token, {
      next: { tags: [`member-${id}`] }, headers: { 'x-gym-slug': gymSlug },
    }),
    apiFetch<MembershipWithRelations[]>(`/memberships?memberId=${id}`, token, {
      next: { tags: [`member-${id}-memberships`] }, headers: { 'x-gym-slug': gymSlug },
    }),
    apiFetch<Payment[]>(`/payments?memberId=${id}`, token, {
      next: { tags: [`member-${id}-payments`] }, headers: { 'x-gym-slug': gymSlug },
    }),
    apiFetch<Attendance[]>(`/attendance?memberId=${id}`, token, {
      next: { tags: [`member-${id}-attendance`] }, headers: { 'x-gym-slug': gymSlug },
    }),
    apiFetch<Plan[]>(`/plans`, token, { headers: { 'x-gym-slug': gymSlug } }),
    apiFetch<{ id: string; name: string; price: number; stock: number; category: string | null; isActive: boolean }[]>('/store/products', token, {
      next: { tags: [`store-products-${gymSlug}`] }, headers: { 'x-gym-slug': gymSlug },
    }),
    apiFetch<{ id: string; productId: string; quantity: number; unitPrice: number; isPaid: boolean; paidAt: string | null; notes: string | null; createdAt: string; product: { name: string; price: number } }[]>(`/store/credits/${id}`, token, {
      cache: 'no-store', headers: { 'x-gym-slug': gymSlug },
    }),
  ])

  if (!member) notFound()

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-3xl">
      {/* Back */}
      <Link
        href={`/gym/${gymSlug}/members`}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          '-ml-2 text-muted-foreground',
        )}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Volver a miembros
      </Link>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-5">
        <div className="flex items-start gap-5 flex-wrap">
          {/* Avatar */}
          <div className="h-16 w-16 rounded-2xl bg-[#1fad9d]/10 flex items-center justify-center shrink-0">
            <span className="text-xl font-black text-[#1fad9d]">
              {initials(`${member.firstName} ${member.lastName}`)}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight">
                {member.firstName} {member.lastName}
              </h1>
              <StatusBadge status={member.isActive ? 'active' : 'inactive'} />
              <a
                href={`?edit=member`}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 transition-all"
              >
                <Pencil className="h-3 w-3" />
                Editar
              </a>
            </div>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {member.email}
              </span>
              {member.phone && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {member.phone}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-1.5">
              Miembro desde {formatDate(member.createdAt)}
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap items-start gap-6">
          {/* Status control */}
          <MemberStatusControl
            memberId={member.id}
            gymSlug={gymSlug}
            isActive={member.isActive}
          />

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Correo</p>
            <ResendWelcomeButton memberId={member.id} />
          </div>
        </div>
      </div>

      {edit === 'member' && (
        <Suspense>
          <EditMemberModal gymSlug={gymSlug} member={member} />
        </Suspense>
      )}

      {/* Tabs */}
      <MemberTabs
        memberId={member.id}
        gymSlug={gymSlug}
        memberships={memberships ?? []}
        payments={payments ?? []}
        attendance={attendance ?? []}
        plans={plans ?? []}
        memberIsActive={member.isActive}
        storeProducts={storeProducts ?? []}
        memberCredits={memberCredits ?? []}
      />
    </div>
  )
}
