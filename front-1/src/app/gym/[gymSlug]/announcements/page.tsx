import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import type { Gym } from '@/types'
import { AnnouncementsClient } from './AnnouncementsClient'
import type { Announcement, AnnouncementQuota } from './types'

interface Props {
  params: Promise<{ gymSlug: string }>
}

export default async function AnnouncementsPage({ params }: Props) {
  const { gymSlug } = await params
  const token = (await cookies()).get('session')?.value ?? ''
  const opts = { headers: { 'x-gym-slug': gymSlug }, next: { tags: [`announcements-${gymSlug}`] } }

  const [quota, history, gym] = await Promise.all([
    apiFetch<AnnouncementQuota>('/communications/announcements/quota', token, opts),
    apiFetch<Announcement[]>('/communications/announcements', token, opts),
    apiFetch<Gym>(`/gyms/${gymSlug}`, token, { next: { tags: [`gym-${gymSlug}`] } }),
  ])

  return <AnnouncementsClient gymSlug={gymSlug} gymName={gym?.name ?? ''} quota={quota} history={history ?? []} />
}
