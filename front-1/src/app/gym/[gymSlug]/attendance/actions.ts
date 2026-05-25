'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { apiFetch } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function checkInAction(
  gymSlug: string,
  memberId: string,
): Promise<{ error?: string }> {
  if (!memberId.trim()) return { error: 'ID de miembro requerido' }
  const token = await getToken()
  const result = await apiFetch('/attendance/checkin', token, {
    method: 'POST',
    body: JSON.stringify({ memberId }),
  })
  if (!result) return { error: 'Error al registrar entrada' }
  updateTag(`attendance-${gymSlug}`)
  return {}
}

export async function checkOutAction(
  gymSlug: string,
  memberId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch('/attendance/checkout', token, {
    method: 'POST',
    body: JSON.stringify({ memberId }),
  })
  if (!result) return { error: 'Error al registrar salida' }
  updateTag(`attendance-${gymSlug}`)
  return {}
}
