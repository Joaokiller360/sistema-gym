import { cookies } from 'next/headers'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Member, Plan } from '@/types'
import { NewPaymentForm } from './NewPaymentForm'
import { getT } from '@/i18n/server'
import { paymentsMessages } from '../messages'

interface Props {
  params: Promise<{ gymSlug: string }>
}

interface MembersResponse { data: Member[]; total: number }

export default async function NewPaymentPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const t = await getT(paymentsMessages)

  const [membersRaw, plans] = await Promise.all([
    apiFetch<MembersResponse | Member[]>(`/members?limit=200`, token, {
      next: { tags: [`members-${gymSlug}`] },
      headers: { 'x-gym-slug': gymSlug },
    }),
    apiFetch<Plan[]>(`/plans`, token, {
      next: { tags: [`plans-${gymSlug}`] },
      headers: { 'x-gym-slug': gymSlug },
    }),
  ])

  const members: Member[] = membersRaw
    ? (Array.isArray(membersRaw) ? membersRaw : membersRaw.data)
    : []

  const activePlans = (plans ?? []).filter(p => p.isActive)

  return (
    <div className="p-6 lg:p-8">
      <Link
        href={`/gym/${gymSlug}/members`}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-black transition-colors mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.backToMembers}
      </Link>

      <div className="max-w-xl mx-auto space-y-2 mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-zinc-400 text-sm">{t.desc}</p>
      </div>

      <div className="max-w-xl mx-auto">
        <NewPaymentForm
          gymSlug={gymSlug}
          members={members}
          plans={activePlans}
        />
      </div>
    </div>
  )
}
