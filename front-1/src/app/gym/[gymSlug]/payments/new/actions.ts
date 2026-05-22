'use server'

import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch, apiFetchWithError } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

const schema = z.object({
  memberId: z.string().min(1, 'Seleccioná un miembro'),
  planId: z.string().min(1, 'Seleccioná un plan'),
  startDate: z.string().min(1),
  durationDays: z.number().int().positive(),
  amount: z.coerce.number().positive('Monto inválido'),
  currency: z.string().min(1),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
  notes: z.string().optional(),
})

export type NewPaymentInput = z.infer<typeof schema>

export async function registerMemberPaymentAction(
  gymSlug: string,
  data: NewPaymentInput,
): Promise<{ error?: string; memberId?: string }> {
  const parsed = schema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const token = await getToken()
  const { memberId, planId, startDate, durationDays, amount, currency, method, notes } = parsed.data

  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + durationDays)

  // 1. Create membership
  const membershipResult = await apiFetchWithError<{ id: string }>('/memberships', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify({
      memberId,
      planId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    }),
  })

  if ('error' in membershipResult) return { error: membershipResult.error }

  // 2. Register payment linked to membership
  const paymentResult = await apiFetch('/payments', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify({
      memberId,
      membershipId: membershipResult.data.id,
      amount: String(Math.round(amount * 100)),
      currency,
      method,
      notes: notes || undefined,
    }),
  })

  if (!paymentResult) return { error: 'Membresía creada pero error al registrar el pago' }

  revalidateTag(`members-${gymSlug}`, 'default')
  revalidateTag(`memberships-${gymSlug}`, 'default')
  revalidateTag(`member-${memberId}`, 'default')
  revalidateTag(`member-${memberId}-memberships`, 'default')
  return { memberId }
}
