'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetchWithError } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

const createMemberSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().max(30).optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
})

export type CreateMemberInput = z.infer<typeof createMemberSchema>

export async function createMemberAction(
  gymSlug: string,
  data: CreateMemberInput,
): Promise<{ error: string } | void> {
  const parsed = createMemberSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const token = await getToken()
  const payload = {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    email: parsed.data.email,
    ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
    ...(parsed.data.birthDate ? { birthDate: new Date(parsed.data.birthDate).toISOString() } : {}),
  }

  const result = await apiFetchWithError('/members', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if ('error' in result) return { error: result.error }

  revalidateTag(`members-${gymSlug}`, 'default')
  redirect(`/gym/${gymSlug}/members`)
}
