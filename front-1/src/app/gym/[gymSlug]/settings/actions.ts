'use server'

import { cookies } from 'next/headers'
import { updateTag, refresh } from 'next/cache'
import { z } from 'zod'
import { apiFetch, apiFetchWithError } from '@/lib/api'
import { getT } from '@/i18n/server'
import { commonMessages } from '@/i18n/common'
import { settingsMessages } from './messages'

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const BACKEND_URL = API_URL.replace(/\/api\/v\d+$/, '')

const settingsSchema = z.object({
  name: z.string().min(1).max(100),
  logoUrl: z.string().nullable().optional(),
  currency: z.enum(['USD', 'ARS', 'EUR', 'CLP', 'MXN', 'COP', 'PEN', 'BRL']).optional(),
  address: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  timezone: z.string().optional(),
  whatsappPhone: z.string().max(20).nullable().optional(),
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
  const t = (await getT(settingsMessages)).actions
  if (!gymId) return { error: t.noGymId }
  const store = await cookies()
  const token = store.get('session')?.value ?? ''

  let res: Response
  try {
    res = await fetch(`${API_URL}/gyms/${gymId}/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
  } catch (err) {
    console.error('[uploadGymLogoAction] fetch error:', err)
    return { error: (await getT(commonMessages)).serverUnreachable }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = t.logoUploadFailed
    try { msg = (JSON.parse(text) as { message?: string }).message ?? msg } catch { /* noop */ }
    return { error: msg }
  }

  const data = (await res.json().catch(() => ({}))) as { logoUrl?: string; url?: string }
  updateTag(`gym-${gymSlug}`)
  return { logoUrl: data.logoUrl ?? data.url ?? '' }
}

export async function updateGymSettingsAction(
  gymSlug: string,
  data: SettingsInput,
  gymId?: string,
): Promise<{ error?: string; newSlug?: string }> {
  const parsed = settingsSchema.safeParse(data)
  if (!parsed.success) return { error: (await getT(commonMessages)).invalidData }

  const token = await getToken()
  const endpoint = gymId ? `/gyms/${gymId}` : `/gyms`
  const result = await apiFetchWithError<{ slug?: string }>(endpoint, token, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  })

  if ('error' in result) return { error: result.error }

  updateTag(`gym-${gymSlug}`)
  const newSlug = result.data.slug
  if (newSlug && newSlug !== gymSlug) updateTag(`gym-${newSlug}`)
  return { newSlug }
}

export async function updateGymScheduleAction(
  gymSlug: string,
  gymId: string,
  schedule: Record<string, { open: string; close: string } | null>,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError(`/gyms/${gymId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ schedule }),
  })
  if ('error' in result) return { error: result.error }
  updateTag(`gym-${gymSlug}`)
  return {}
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
})

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<{ error?: string }> {
  const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword })
  if (!parsed.success) return { error: (await getT(commonMessages)).invalidData }
  const token = await getToken()
  const result = await apiFetchWithError('/auth/change-password', token, {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword }),
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

// Staff routes need the gym slug: a super admin's token carries no gym
export async function getGymAdminsAction(gymSlug: string): Promise<GymAdmin[]> {
  const token = await getToken()
  const result = await apiFetch<GymAdmin[]>('/gyms/staff/list', token, { headers: { 'x-gym-slug': gymSlug } })
  return result ?? []
}

const gymAdminSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
})

export async function createGymAdminAction(
  gymSlug: string,
  name: string,
  email: string,
): Promise<{ error?: string; tempPassword?: string; emailSent?: boolean }> {
  const parsed = gymAdminSchema.safeParse({ name, email })
  if (!parsed.success) return { error: (await getT(commonMessages)).invalidData }
  const token = await getToken()
  // The API emails the credentials itself and reports whether that worked
  const result = await apiFetchWithError<{ id: string; tempPassword: string; emailSent?: boolean }>('/gyms/staff', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify({ name: parsed.data.name, email: parsed.data.email }),
  })
  if ('error' in result) return { error: result.error }

  // Re-render the current page in this same round trip
  refresh()
  return { tempPassword: result.data.tempPassword, emailSent: result.data.emailSent ?? false }
}

export async function deleteGymAdminAction(gymSlug: string, userId: string): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError(`/gyms/staff/${userId}`, token, { method: 'DELETE', headers: { 'x-gym-slug': gymSlug } })
  if ('error' in result) return { error: result.error }
  // Re-render the current page in this same round trip
  refresh()
  return {}
}
