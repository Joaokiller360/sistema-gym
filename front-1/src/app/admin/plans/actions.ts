'use server'

import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

const planSchema = z.object({
  label: z.string().min(1, 'Nombre requerido'),
  price: z.number().min(0, 'Precio inválido'),
  currency: z.string().min(1),
  maxMembers: z.number().int().positive().nullable().optional(),
  features: z.array(z.string()),
  isActive: z.boolean().optional(),
})

export async function updateSubscriptionPlanAction(
  id: string,
  data: { label?: string; price?: string | number; currency?: string; maxMembers?: number | null; storeEnabled?: boolean; features?: string[]; isActive?: boolean },
): Promise<{ error?: string }> {
  const token = await getToken()
  const payload = {
    ...data,
    ...(data.price != null ? { price: Math.round(Number(data.price)) } : {}),
  }
  const result = await apiFetch(`/admin/subscription-plans/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!result) return { error: 'Error al actualizar el plan' }
  revalidateTag('admin-subscription-plans', 'default')
  return {}
}

export async function createSubscriptionPlanAction(
  data: { key: string; label: string; price: string | number; currency: string; maxMembers?: number | null; storeEnabled?: boolean; features?: string[] },
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch('/admin/subscription-plans', token, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      price: Math.round(Number(data.price)),
    }),
  })
  if (!result) return { error: 'Error al crear el plan' }
  revalidateTag('admin-subscription-plans', 'default')
  return {}
}

export async function deleteSubscriptionPlanAction(id: string): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/admin/subscription-plans/${id}`, token, { method: 'DELETE' })
  if (!result) return { error: 'Error al eliminar el plan' }
  revalidateTag('admin-subscription-plans', 'default')
  return {}
}
