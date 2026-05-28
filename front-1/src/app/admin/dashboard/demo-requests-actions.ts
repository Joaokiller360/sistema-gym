'use server'

import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function updateDemoRequestStatusAction(
  id: string,
  status: 'PENDING' | 'CONTACTED' | 'DISMISSED',
): Promise<{ error?: string }> {
  if (!id || !['PENDING', 'CONTACTED', 'DISMISSED'].includes(status)) {
    return { error: 'Parámetros inválidos' }
  }
  const token = await getToken()
  const result = await apiFetch(`/admin/demo-requests/${id}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  if (!result) return { error: 'Error al actualizar el estado' }
  return {}
}
