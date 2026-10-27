'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch } from '@/lib/api'
import { getT } from '@/i18n/server'
import { commonMessages } from '@/i18n/common'
import { trainersMessages } from './messages'

type Messages = (typeof trainersMessages)['es']

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

const trainerSchema = (t: Messages) => z.object({
  firstName: z.string().min(1, t.firstNameRequired),
  lastName: z.string().min(1, t.lastNameRequired),
  email: z.string().email(t.badEmail),
  phone: z.string().optional(),
  specialty: z.string().optional(),
})

export async function createTrainerAction(
  gymSlug: string,
  data: { firstName: string; lastName: string; email: string; phone?: string; specialty?: string },
): Promise<{ error?: string }> {
  const t = await getT(trainersMessages)
  const parsed = trainerSchema(t).safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? (await getT(commonMessages)).invalidData }

  const token = await getToken()
  const result = await apiFetch('/trainers', token, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  })
  if (!result) return { error: t.createFailed }
  updateTag(`trainers-${gymSlug}`)
  return {}
}

export async function deleteTrainerAction(
  gymSlug: string,
  trainerId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/trainers/${trainerId}`, token, { method: 'DELETE' })
  if (result === null) return { error: (await getT(trainersMessages)).deleteFailed }
  updateTag(`trainers-${gymSlug}`)
  return {}
}
