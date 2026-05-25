'use server'

import { cookies } from 'next/headers'
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

export async function getAdminProfileAction(): Promise<AdminProfile | null> {
  const token = await getToken()
  return apiFetch<AdminProfile>('/auth/me', token)
}

export async function updateAdminProfileAction(
  data: { name?: string; email?: string },
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError('/auth/me', token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if ('error' in result) return { error: result.error }
  return {}
}

export async function changeAdminPasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError('/auth/change-password', token, {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if ('error' in result) return { error: result.error }
  return {}
}
