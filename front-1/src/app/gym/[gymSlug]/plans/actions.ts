'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch } from '@/lib/api'

const planSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0),
  currency: z.string().min(1),
  durationDays: z.number().int().min(1),
  daysPerWeek: z.string().min(1),
  benefits: z.array(z.object({ value: z.string() })).default([]),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
})

export type PlanActionInput = z.infer<typeof planSchema>

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

function buildPayload(data: PlanActionInput) {
  return {
    name: data.name,
    price: String(Math.round(data.price * 100)),
    currency: data.currency,
    durationDays: data.durationDays,
    daysPerWeek: data.daysPerWeek === 'unlimited' ? null : parseInt(data.daysPerWeek, 10),
    benefits: data.benefits.map((b) => b.value.trim()).filter(Boolean),
    isActive: data.isActive,
    isFeatured: data.isFeatured,
  }
}

export async function createPlanAction(
  gymSlug: string,
  data: PlanActionInput,
): Promise<{ error: string }> {
  const parsed = planSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const token = await getToken()
  const result = await apiFetch(`/plans`, token, {
    method: 'POST',
    body: JSON.stringify(buildPayload(parsed.data)),
  })

  if (!result) return { error: 'Error al crear el plan' }

  revalidateTag(`plans-${gymSlug}`, 'default')
  redirect(`/gym/${gymSlug}/plans`)
}

export async function updatePlanAction(
  gymSlug: string,
  planId: string,
  data: PlanActionInput,
): Promise<{ error: string }> {
  const parsed = planSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const token = await getToken()
  const result = await apiFetch(`/plans/${planId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(buildPayload(parsed.data)),
  })

  if (!result) return { error: 'Error al actualizar el plan' }

  revalidateTag(`plans-${gymSlug}`, 'default')
  revalidateTag(`plan-${planId}`, 'default')
  redirect(`/gym/${gymSlug}/plans`)
}

export async function togglePlanActiveAction(
  gymSlug: string,
  planId: string,
  active: boolean,
): Promise<void> {
  const token = await getToken()
  await apiFetch(`/plans/${planId}/toggle`, token, { method: 'PATCH' })
  revalidateTag(`plans-${gymSlug}`, 'default')
}

export async function deletePlanAction(gymSlug: string, planId: string): Promise<void> {
  const token = await getToken()
  await apiFetch(`/plans/${planId}`, token, { method: 'DELETE' })
  revalidateTag(`plans-${gymSlug}`, 'default')
}
