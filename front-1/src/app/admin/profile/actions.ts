'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'
import { apiFetch, apiFetchWithError } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export interface AdminProfile {
  id: string
  name: string
  email: string
}

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
})

export async function getAdminProfileAction(): Promise<AdminProfile | null> {
  const token = await getToken()
  return apiFetch<AdminProfile>('/auth/me', token)
}

export async function updateAdminProfileAction(
  data: { name?: string; email?: string },
): Promise<{ error?: string }> {
  const parsed = updateProfileSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const token = await getToken()
  const result = await apiFetchWithError('/auth/me', token, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  })
  if ('error' in result) return { error: result.error }
  return {}
}

export async function changeAdminPasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<{ error?: string }> {
  const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const token = await getToken()
  const result = await apiFetchWithError('/auth/change-password', token, {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword }),
  })
  if ('error' in result) return { error: result.error }
  return {}
}
