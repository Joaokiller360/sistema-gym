'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { apiFetch } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}


export async function updateSubscriptionPlanAction(
  id: string,
  data: { label?: string; price?: string | number; currency?: string; maxMembers?: number | null; storeEnabled?: boolean; features?: string[]; isActive?: boolean },
  planKey?: string,
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
  updateTag('admin-subscription-plans')
  if (planKey) {
    const gyms = await apiFetch<{ data: { slug: string; subscriptionPlan: string }[] } | { slug: string; subscriptionPlan: string }[]>(
      '/admin/gyms?limit=1000',
      token,
    )
    const list = Array.isArray(gyms) ? gyms : gyms?.data ?? []
    list
      .filter(g => g.subscriptionPlan === planKey)
      .forEach(g => updateTag(`gym-${g.slug}`))
  }
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
  updateTag('admin-subscription-plans')
  return {}
}

export async function deleteSubscriptionPlanAction(id: string): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/admin/subscription-plans/${id}`, token, { method: 'DELETE' })
  if (!result) return { error: 'Error al eliminar el plan' }
  updateTag('admin-subscription-plans')
  return {}
}
