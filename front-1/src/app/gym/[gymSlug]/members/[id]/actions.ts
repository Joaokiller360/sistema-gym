'use server'

import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch, apiFetchWithError } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

const updateMemberSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().max(10).regex(/^\d*$/, 'Solo números').optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
})

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>

export async function updateMemberAction(
  gymSlug: string,
  memberId: string,
  data: UpdateMemberInput,
): Promise<{ error?: string }> {
  const parsed = updateMemberSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const token = await getToken()
  const phone = parsed.data.phone?.trim()
  const birthDate = parsed.data.birthDate?.trim()

  const payload: Record<string, unknown> = {
    firstName: parsed.data.firstName.trim(),
    lastName: parsed.data.lastName.trim(),
    email: parsed.data.email.trim().toLowerCase(),
    phone: phone && phone.length >= 7 ? phone : null,
    ...(birthDate ? { birthDate: new Date(birthDate).toISOString() } : { birthDate: null }),
  }

  const result = await apiFetchWithError(`/members/${memberId}`, token, {
    method: 'PATCH',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(payload),
  })

  if ('error' in result) return { error: result.error }

  revalidateTag(`member-${memberId}`, 'default')
  revalidateTag(`members-${gymSlug}`, 'default')
  return {}
}

export async function toggleMemberActiveAction(
  gymSlug: string,
  memberId: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/members/${memberId}`, token, {
    method: 'PATCH',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify({ isActive }),
  })
  if (!result) return { error: 'Error al actualizar el estado' }
  revalidateTag(`member-${memberId}`, 'default')
  revalidateTag(`members-${gymSlug}`, 'default')
  return {}
}

const assignPlanSchema = z.object({
  planId: z.string().min(1, 'Seleccioná un plan'),
  startDate: z.string().min(1, 'Ingresá la fecha de inicio'),
  durationDays: z.number().int().positive(),
  price: z.number().positive(),
  currency: z.string().min(1),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
})

export async function assignPlanAction(
  gymSlug: string,
  memberId: string,
  data: { planId: string; startDate: string; durationDays: number; price: number; currency: string; method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER' },
  activeMembershipId?: string,
): Promise<{ error?: string }> {
  const parsed = assignPlanSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const start = new Date(parsed.data.startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + parsed.data.durationDays)

  const token = await getToken()

  if (activeMembershipId) {
    await apiFetch(`/memberships/${activeMembershipId}/cancel`, token, {
      method: 'PATCH',
      headers: { 'x-gym-slug': gymSlug },
    })
  }

  const membershipResult = await apiFetchWithError<{ id: string }>('/memberships', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify({
      memberId,
      planId: parsed.data.planId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    }),
  })

  if ('error' in membershipResult) return { error: membershipResult.error }

  await apiFetch('/payments', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify({
      memberId,
      membershipId: membershipResult.data.id,
      amount: String(Math.round(parsed.data.price * 100)),
      currency: parsed.data.currency,
      method: parsed.data.method,
    }),
  })

  revalidateTag(`member-${memberId}-memberships`, 'default')
  revalidateTag(`member-${memberId}-payments`, 'default')
  revalidateTag(`memberships-${gymSlug}`, 'default')
  return {}
}

const paymentSchema = z.object({
  amount: z.number().positive('Monto inválido'),
  currency: z.string().min(1),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
  notes: z.string().optional(),
  membershipId: z.string().optional(),
})

export async function resendWelcomeEmailAction(
  memberId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError(`/members/${memberId}/resend-welcome`, token, {
    method: 'POST',
  })
  if ('error' in result) return { error: result.error }
  return {}
}

export interface ProratedResult {
  daysConsumed: number
  daysRemaining: number
  dailyRate: number
  creditAmount: number
  newPlanPrice: number
  creditApplied: number
  amountDue: number
}

export async function changeMemberPlanAction(
  gymSlug: string,
  memberId: string,
  membershipId: string,
  data: { planId: string; method?: string; notes?: string },
): Promise<{ error?: string; proration?: ProratedResult }> {
  const token = await getToken()
  const body: Record<string, unknown> = { planId: data.planId }
  if (data.method) body.method = data.method
  if (data.notes) body.notes = data.notes

  const result = await apiFetchWithError<{ proration: ProratedResult }>(`/memberships/${membershipId}/change-plan`, token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(body),
  })
  if ('error' in result) return { error: result.error }
  revalidateTag(`member-${memberId}-memberships`, 'default')
  revalidateTag(`member-${memberId}-payments`, 'default')
  revalidateTag(`members-${gymSlug}`, 'default')
  return { proration: result.data.proration }
}

export async function deletePaymentAction(
  gymSlug: string,
  memberId: string,
  paymentId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/payments/${paymentId}`, token, { method: 'DELETE', headers: { 'x-gym-slug': gymSlug } })
  if (result === null) return { error: 'Error al eliminar el pago' }
  revalidateTag(`member-${memberId}-payments`, 'default')
  revalidateTag(`members-${gymSlug}`, 'default')
  return {}
}

export async function deleteMemberAction(
  gymSlug: string,
  memberId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/members/${memberId}`, token, {
    method: 'DELETE',
    headers: { 'x-gym-slug': gymSlug },
  })
  if (result === null) return { error: 'Error al eliminar el miembro' }
  revalidateTag(`members-${gymSlug}`, 'default')
  return {}
}

export async function registerPaymentAction(
  gymSlug: string,
  memberId: string,
  data: {
    amount: number
    currency: string
    method: string
    notes?: string
    membershipId?: string
  },
): Promise<{ error?: string }> {
  const parsed = paymentSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const token = await getToken()
  const result = await apiFetch('/payments', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify({
      ...parsed.data,
      memberId,
      amount: String(Math.round(parsed.data.amount * 100)),
    }),
  })

  if (!result) return { error: 'Error al registrar el pago' }
  revalidateTag(`member-${memberId}-payments`, 'default')
  return {}
}
