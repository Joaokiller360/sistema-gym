'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

const trainerSchema = z.object({
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  specialty: z.string().optional(),
})

export async function createTrainerAction(
  gymSlug: string,
  data: { firstName: string; lastName: string; email: string; phone?: string; specialty?: string },
): Promise<{ error?: string }> {
  const parsed = trainerSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const token = await getToken()
  const result = await apiFetch('/trainers', token, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  })
  if (!result) return { error: 'Error al crear entrenador' }
  updateTag(`trainers-${gymSlug}`)
  return {}
}

export async function deleteTrainerAction(
  gymSlug: string,
  trainerId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/trainers/${trainerId}`, token, { method: 'DELETE' })
  if (result === null) return { error: 'Error al eliminar entrenador' }
  updateTag(`trainers-${gymSlug}`)
  return {}
}
