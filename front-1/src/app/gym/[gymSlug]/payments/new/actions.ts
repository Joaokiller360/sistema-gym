'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch, apiFetchWithError } from '@/lib/api'
import { getT } from '@/i18n/server'
import { commonMessages } from '@/i18n/common'
import { paymentsMessages } from '../messages'

type Messages = (typeof paymentsMessages)['es']

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

const schema = (t: Messages) => z.object({
  memberId: z.string().min(1, t.pickMember),
  planId: z.string().min(1, t.pickPlan),
  startDate: z.string().min(1),
  durationDays: z.number().int().positive(),
  periods: z.number().int().min(1).max(24).default(1),
  amount: z.coerce.number().positive(t.badAmount),
  currency: z.string().min(1),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
  notes: z.string().optional(),
  companionIds: z.array(z.string().uuid()).max(4).default([]),
})

export type NewPaymentInput = z.infer<ReturnType<typeof schema>>

export async function registerMemberPaymentAction(
  gymSlug: string,
  data: NewPaymentInput,
): Promise<{ error?: string; memberId?: string }> {
  const t = await getT(paymentsMessages)
  const parsed = schema(t).safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? (await getT(commonMessages)).invalidData }

  const token = await getToken()
  const { memberId, planId, startDate, durationDays, periods, amount, currency, method, notes, companionIds } = parsed.data

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
      periods,
      ...(companionIds.length ? { companionIds } : {}),
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
      amount: Math.round(amount * 100),
      currency,
      method,
      notes: notes || undefined,
    }),
  })

  if (!paymentResult) return { error: t.paymentFailed }

  updateTag(`members-${gymSlug}`)
  updateTag(`memberships-${gymSlug}`)
  updateTag(`member-${memberId}`)
  updateTag(`member-${memberId}-memberships`)
  for (const id of companionIds) updateTag(`member-${id}-memberships`)
  return { memberId }
}
