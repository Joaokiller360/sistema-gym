'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { apiFetch, apiFetchWithError } from '@/lib/api'
import { type PlatformSettings, DEFAULT_PLATFORM_SETTINGS } from './types'

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const BACKEND_URL = API_URL.replace(/\/api\/v\d+$/, '')

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function getPlatformSettingsAction(): Promise<PlatformSettings> {
  const token = await getToken()
  const result = await apiFetch<PlatformSettings>('/platform-settings', token, {
    next: { tags: ['platform-settings'] },
  })
  return result ?? DEFAULT_PLATFORM_SETTINGS
}

export async function updatePlatformSettingsAction(
  data: Partial<PlatformSettings>,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError('/admin/platform-settings', token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if ('error' in result) return { error: result.error }
  updateTag('platform-settings')
  return {}
}

export async function uploadPlatformLogoAction(
  formData: FormData,
): Promise<{ error?: string; logoUrl?: string }> {
  const token = await getToken()
  const res = await fetch(`${API_URL}/admin/platform-settings/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = 'Error al subir la imagen'
    try { msg = (JSON.parse(text) as { message?: string }).message ?? msg } catch { /* noop */ }
    return { error: msg }
  }
  const data = (await res.json().catch(() => ({}))) as { logoUrl?: string; url?: string }
  updateTag('platform-settings')
  const raw = data.logoUrl ?? data.url ?? ''
  return { logoUrl: raw.startsWith('/') ? `${BACKEND_URL}${raw}` : raw }
}
