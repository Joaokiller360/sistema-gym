'use server'

import { cookies } from 'next/headers'
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
  phone: z.string().max(10).regex(/^\d*$/, 'Solo números').optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
})

export type CreateMemberInput = z.infer<typeof createMemberSchema>

export async function createMemberAction(
  gymSlug: string,
  data: CreateMemberInput,
): Promise<{ error: string } | { memberId: string }> {
  const parsed = createMemberSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const token = await getToken()
  const phone = parsed.data.phone?.trim()
  const birthDate = parsed.data.birthDate?.trim()

  const payload = {
    firstName: parsed.data.firstName.trim(),
    lastName: parsed.data.lastName.trim(),
    email: parsed.data.email.trim().toLowerCase(),
    ...(phone && phone.length >= 7 ? { phone } : {}),
    ...(birthDate ? { birthDate: new Date(birthDate).toISOString() } : {}),
  }

  const result = await apiFetchWithError<{ id: string }>('/members', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(payload),
  })

  if ('error' in result) {
    const raw = result.error.toLowerCase()
    if (raw.includes('already') || raw.includes('duplicate') || raw.includes('exist') || raw.includes('único') || raw.includes('unique')) {
      return { error: 'Ya existe un miembro con ese correo electrónico' }
    }
    if (raw === 'internal server error' || raw === 'error 500') {
      return { error: 'Error del servidor. Verificá los datos e intentá de nuevo.' }
    }
    return { error: result.error }
  }

  revalidateTag(`members-${gymSlug}`, 'default')
  return { memberId: result.data.id }
}
