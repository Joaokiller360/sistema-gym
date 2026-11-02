'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'
import { updateTag } from 'next/cache'
import { apiFetchWithError } from '@/lib/api'
import { getT } from '@/i18n/server'
import { announcementsMessages } from './messages'
import { ANNOUNCEMENT_TYPES, type AnnouncementType } from './types'

const schema = (t: { subjectRequired: string; bodyRequired: string }) => z.object({
  type: z.enum(ANNOUNCEMENT_TYPES),
  subject: z.string().trim().min(1, t.subjectRequired).max(60),
  body: z.string().trim().min(1, t.bodyRequired).max(700),
})

export async function sendAnnouncementAction(
  gymSlug: string,
  data: { type: AnnouncementType; subject: string; body: string },
): Promise<{ error?: string; recipientCount?: number }> {
  const parsed = schema(await getT(announcementsMessages)).safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const token = (await cookies()).get('session')?.value ?? ''
  const result = await apiFetchWithError<{ id: string; recipientCount: number }>('/communications/announcements', token, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
    headers: { 'x-gym-slug': gymSlug },
  })
  if ('error' in result) return { error: result.error }
  updateTag(`announcements-${gymSlug}`)
  return { recipientCount: result.data.recipientCount }
}
