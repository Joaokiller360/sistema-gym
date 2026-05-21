'use server'

import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch, apiFetchWithError } from '@/lib/api'

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const BACKEND_URL = API_URL.replace(/\/api\/v\d+$/, '')

const settingsSchema = z.object({
  name: z.string().min(1).max(100),
  logoUrl: z.string().nullable().optional(),
  currency: z.enum(['USD', 'ARS', 'EUR', 'CLP', 'MXN', 'COP', 'PEN', 'BRL']).optional(),
  address: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  timezone: z.string().optional(),
})

export type SettingsInput = z.infer<typeof settingsSchema>

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function uploadGymLogoAction(
  gymId: string,
  gymSlug: string,
  formData: FormData,
): Promise<{ error?: string; logoUrl?: string }> {
  const store = await cookies()
  const token = store.get('session')?.value ?? ''

  const res = await fetch(`${API_URL}/gyms/${gymId}/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = 'Error al subir el logo'
    try { msg = (JSON.parse(text) as { message?: string }).message ?? msg } catch { /* noop */ }
    return { error: msg }
  }

  const data = (await res.json().catch(() => ({}))) as { logoUrl?: string; url?: string }
  revalidateTag(`gym-${gymSlug}`, 'default')
  const raw = data.logoUrl ?? data.url ?? ''
  return { logoUrl: raw.startsWith('/') ? `${BACKEND_URL}${raw}` : raw }
}

export async function updateGymSettingsAction(
  gymSlug: string,
  data: SettingsInput,
  gymId?: string,
): Promise<{ error?: string }> {
  const parsed = settingsSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const token = await getToken()
  const endpoint = gymId ? `/gyms/${gymId}` : `/gyms`
  const result = await apiFetch(endpoint, token, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  })

  if (!result) return { error: 'Error al guardar los cambios' }

  revalidateTag(`gym-${gymSlug}`, 'default')
  return {}
}

export async function changePasswordAction(
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

export interface GymAdmin {
  id: string
  name: string
  email: string
  isActive: boolean
  createdAt: string
}

export async function getGymAdminsAction(): Promise<GymAdmin[]> {
  const token = await getToken()
  const result = await apiFetch<GymAdmin[]>('/gyms/staff/list', token)
  return result ?? []
}

export async function createGymAdminAction(
  name: string,
  email: string,
): Promise<{ error?: string; tempPassword?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError<{ id: string; tempPassword: string }>('/gyms/staff', token, {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  })
  if ('error' in result) return { error: result.error }

  // Send welcome email — fire and forget, don't block on failure
  await apiFetch(`/gyms/staff/${result.data.id}/resend-welcome`, token, { method: 'POST' }).catch(() => {})

  return { tempPassword: result.data.tempPassword }
}

export async function deleteGymAdminAction(userId: string): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError(`/gyms/staff/${userId}`, token, { method: 'DELETE' })
  if ('error' in result) return { error: result.error }
  return {}
}
