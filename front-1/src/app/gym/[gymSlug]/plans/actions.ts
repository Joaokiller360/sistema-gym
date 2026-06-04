'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch } from '@/lib/api'

const ONLY_LETTERS_NUMBERS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s]+$/

const planSchema = z.object({
  name: z.string().min(1).max(100).refine(v => ONLY_LETTERS_NUMBERS.test(v), 'Solo letras y números'),
  price: z.number().min(0).max(999),
  currency: z.string().min(1),
  durationDays: z.number().int().min(1).max(365),
  daysPerWeek: z.string().min(1),
  benefits: z.array(z.object({
    value: z.string().refine(v => v === '' || ONLY_LETTERS_NUMBERS.test(v), 'Solo letras y números'),
  })).default([]),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  storeEnabled: z.boolean(),
})

export type PlanActionInput = z.infer<typeof planSchema>

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

function buildPayload(data: PlanActionInput) {
  return {
    name: data.name,
    price: Math.round(data.price * 100),
    currency: data.currency,
    durationDays: data.durationDays,
    daysPerWeek: data.daysPerWeek === 'unlimited' ? null : parseInt(data.daysPerWeek, 10),
    benefits: data.benefits.map((b) => b.value.trim()).filter(Boolean),
    isActive: data.isActive,
    isFeatured: data.isFeatured,
    storeEnabled: data.storeEnabled,
  }
}

export async function createPlanAction(
  gymSlug: string,
  data: PlanActionInput,
): Promise<{ error?: string }> {
  const parsed = planSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const token = await getToken()
  const result = await apiFetch(`/plans`, token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(buildPayload(parsed.data)),
  })

  if (!result) return { error: 'Error al crear el plan' }

  updateTag(`plans-${gymSlug}`)
  updateTag(`gym-${gymSlug}`)
  return {}
}

export async function updatePlanAction(
  gymSlug: string,
  planId: string,
  data: PlanActionInput,
): Promise<{ error?: string }> {
  const parsed = planSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const token = await getToken()
  const result = await apiFetch(`/plans/${planId}`, token, {
    method: 'PATCH',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(buildPayload(parsed.data)),
  })

  if (!result) return { error: 'Error al actualizar el plan' }

  updateTag(`plans-${gymSlug}`)
  updateTag(`plan-${planId}`)
  updateTag(`gym-${gymSlug}`)
  return {}
}

export async function togglePlanActiveAction(
  gymSlug: string,
  planId: string,
  _active: boolean,
): Promise<void> {
  const token = await getToken()
  await apiFetch(`/plans/${planId}/toggle`, token, { method: 'PATCH', headers: { 'x-gym-slug': gymSlug } })
  updateTag(`plans-${gymSlug}`)
  updateTag(`gym-${gymSlug}`)
}

export async function deletePlanAction(gymSlug: string, planId: string): Promise<void> {
  const token = await getToken()
  await apiFetch(`/plans/${planId}`, token, { method: 'DELETE', headers: { 'x-gym-slug': gymSlug } })
  updateTag(`plans-${gymSlug}`)
  updateTag(`gym-${gymSlug}`)
}

