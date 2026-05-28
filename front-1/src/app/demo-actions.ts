'use server'

import { apiFetch } from '@/lib/api'

export interface DemoRequestPayload {
  name: string
  email: string
  phone?: string
  gymName: string
  planId: string
  planLabel: string
}

export async function submitDemoRequestAction(
  payload: DemoRequestPayload,
): Promise<{ error?: string }> {
  if (!payload.name?.trim() || payload.name.trim().length < 2) return { error: 'Nombre inválido' }
  if (!payload.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) return { error: 'Email inválido' }
  if (!payload.gymName?.trim() || payload.gymName.trim().length < 2) return { error: 'Nombre del gimnasio inválido' }
  if (!payload.planId?.trim()) return { error: 'Plan inválido' }

  const result = await apiFetch('/demo-requests', '', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || undefined,
      gymName: payload.gymName.trim(),
      planId: payload.planId,
      planLabel: payload.planLabel,
    }),
  })

  if (!result) return { error: 'Error al enviar la solicitud. Intentá de nuevo.' }
  return {}
}
