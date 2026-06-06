import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Member, AttendanceGroup } from '@/types'
import { QuickCheckInModalClient } from './QuickCheckInModalClient'

interface MembersResponse { data: Member[]; total: number }

interface Props { gymSlug: string }

export async function QuickCheckInModal({ gymSlug }: Props) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const gymHeader = { headers: { 'x-gym-slug': gymSlug } }

  const [membersRaw, groups] = await Promise.all([
    apiFetch<MembersResponse | Member[]>('/members?limit=500', token, gymHeader),
    apiFetch<AttendanceGroup[]>('/attendance/groups', token, gymHeader),
  ])

  const members: Member[] = membersRaw
    ? (Array.isArray(membersRaw) ? membersRaw : membersRaw.data)
    : []

  return (
    <QuickCheckInModalClient
      gymSlug={gymSlug}
      members={members}
      groups={groups ?? []}
    />
  )
}
