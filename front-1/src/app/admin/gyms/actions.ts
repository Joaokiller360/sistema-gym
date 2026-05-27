'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch, apiFetchWithError } from '@/lib/api'

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const BACKEND_URL = API_URL.replace(/\/api\/v\d+$/, '')

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function uploadGymLogoAction(
  gymId: string,
  formData: FormData,
): Promise<{ error?: string; logoUrl?: string }> {
  const token = await getToken()

  const res = await fetch(`${API_URL}/gyms/${gymId}/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = 'Error al subir el logo'
    try { msg = (JSON.parse(text) as { message?: string }).message ?? msg } catch { /* noop */ }
    return { error: msg }
  }

  const data = (await res.json().catch(() => ({}))) as { logoUrl?: string; url?: string }
  updateTag('admin-gyms')
  updateTag(`admin-gym-${gymId}`)
  const raw = data.logoUrl ?? data.url ?? ''
  return { logoUrl: raw.startsWith('/') ? `${BACKEND_URL}${raw}` : raw }
}

const ownerSchema = z.object({
  name: z.string().min(1, 'Nombre del dueño requerido'),
  email: z.string().email('Email inválido'),
})

function safePublicUrl() {
  return z.string().url().refine(
    (u) => {
      try {
        const parsed = new URL(u)
        return parsed.protocol === 'https:' && !['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname) && !parsed.hostname.startsWith('169.254.') && !parsed.hostname.startsWith('10.') && !parsed.hostname.startsWith('192.168.')
      } catch { return false }
    },
    'URL debe ser HTTPS pública'
  )
}

const createGymSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  logoUrl: safePublicUrl().optional().or(z.literal('')),
  subscriptionPlan: z.string().optional(),
  owner: ownerSchema.optional(),
})

export type CreateGymInput = z.infer<typeof createGymSchema>

export async function createGymAction(data: CreateGymInput): Promise<{ error: string } | { gymId: string }> {
  const parsed = createGymSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const token = await getToken()
  const payload: Record<string, unknown> = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    ...(parsed.data.logoUrl ? { logoUrl: parsed.data.logoUrl } : {}),
    ...(parsed.data.subscriptionPlan ? { subscriptionPlan: parsed.data.subscriptionPlan } : {}),
    ...(parsed.data.owner ? { owner: parsed.data.owner } : {}),
  }

  const result = await apiFetchWithError<{ id: string }>('/admin/gyms', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if ('error' in result) return { error: result.error }

  updateTag('admin-gyms')
  return { gymId: result.data.id }
}

const updateGymSchema = createGymSchema.partial()

export async function updateGymAction(gymId: string, data: Partial<CreateGymInput>): Promise<{ error: string } | void> {
  const parsed = updateGymSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const token = await getToken()
  const result = await apiFetch(`/admin/gyms/${gymId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  })
  if (!result) return { error: 'Error al actualizar el gimnasio' }
  updateTag('admin-gyms')
  updateTag(`admin-gym-${gymId}`)
  const slug = (data as Partial<CreateGymInput>).slug
  if (slug) updateTag(`gym-${slug}`)
}

export async function deleteGymAction(gymId: string): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/admin/gyms/${gymId}`, token, { method: 'DELETE' })
  if (!result) return { error: 'Error al eliminar el gimnasio' }
  updateTag('admin-gyms')
  redirect('/admin/gyms')
}

export async function updateGymOwnerAction(
  gymId: string,
  ownerData: { name?: string; email?: string; password?: string },
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/admin/gyms/${gymId}/owner-profile`, token, {
    method: 'PATCH',
    body: JSON.stringify(ownerData),
  })
  if (!result) return { error: 'Error al actualizar el dueño' }
  updateTag(`admin-gym-${gymId}`)
  return {}
}

export async function resendGymWelcomeEmailAction(gymId: string): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError(`/admin/gyms/${gymId}/resend-welcome`, token, { method: 'POST' })
  if ('error' in result) return { error: result.error }
  return {}
}

export async function toggleGymActiveAction(gymId: string, active: boolean): Promise<void> {
  const token = await getToken()
  await apiFetch(active ? `/admin/gyms/${gymId}/enable` : `/admin/gyms/${gymId}/disable`, token, {
    method: 'PATCH',
  })
  updateTag('admin-gyms')
}

export interface SubscriptionInfo {
  id: string
  name: string
  subscriptionPlan: string
  subscriptionStatus: 'ACTIVE' | 'GRACE' | 'SUSPENDED'
  subscriptionExpiresAt: string | null
  subscriptionGraceEndsAt: string | null
  isActive: boolean
  daysUntilExpiry: number | null
}

export interface BillingRecord {
  id: string
  amount: string
  currency: string
  method: string
  notes: string | null
  periodStart: string
  periodEnd: string
  createdAt: string
}

const paymentSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  currency: z.enum(['USD', 'ARS', 'EUR']).default('USD'),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']).default('CASH'),
  notes: z.string().optional(),
})

export type PaymentInput = z.infer<typeof paymentSchema>

export async function registerSubscriptionPaymentAction(
  gymId: string,
  data: PaymentInput,
): Promise<{ error?: string }> {
  const parsed = paymentSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const token = await getToken()
  const result = await apiFetchWithError(`/admin/gyms/${gymId}/subscription-payment`, token, {
    method: 'POST',
    body: JSON.stringify({ ...parsed.data, amount: parsed.data.amount * 10000 }),
  })

  if ('error' in result) return { error: result.error }
  updateTag(`admin-gym-${gymId}`)
  updateTag(`admin-gym-${gymId}-subscription`)
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

export async function changeGymPlanAction(
  gymId: string,
  data: { planKey: string; amount?: number; method?: string; notes?: string },
  gymSlug?: string,
): Promise<{ error?: string; proration?: ProratedResult }> {
  const token = await getToken()
  const body: Record<string, unknown> = { planKey: data.planKey }
  if (data.amount != null) body.amount = data.amount / 100
  if (data.method) body.method = data.method
  if (data.notes) body.notes = data.notes

  const result = await apiFetchWithError<{ proration: ProratedResult }>(`/admin/gyms/${gymId}/change-plan`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if ('error' in result) return { error: result.error }
  updateTag(`admin-gym-${gymId}`)
  updateTag(`admin-gym-${gymId}-subscription`)
  updateTag('admin-gyms')
  if (gymSlug) updateTag(`gym-${gymSlug}`)
  return { proration: result.data.proration }
}

export interface GymModalData {
  members: Array<{ id: string; firstName: string; lastName: string; email: string; isActive: boolean; photoUrl: string | null }>
  plans: Array<{ id: string; name: string; price: number; currency: string; durationDays: number; isActive: boolean; isFeatured: boolean }>
  subscription: SubscriptionInfo | null
  subPlans: Array<{ key: string; label?: string; price: number | string; currency: string }>
}

export async function fetchGymModalDataAction(gymId: string): Promise<GymModalData> {
  const token = await getToken()
  const [membersRaw, plansRaw, subscription, subPlans] = await Promise.all([
    apiFetch<{ data: GymModalData['members'] } | GymModalData['members']>(`/members?gymId=${gymId}&limit=5`, token),
    apiFetch<{ data: GymModalData['plans'] } | GymModalData['plans']>(`/plans?gymId=${gymId}`, token),
    apiFetch<SubscriptionInfo>(`/admin/gyms/${gymId}/subscription`, token),
    apiFetch<GymModalData['subPlans']>(`/admin/subscription-plans`, token),
  ])
  return {
    members: membersRaw ? (Array.isArray(membersRaw) ? membersRaw : membersRaw.data).slice(0, 5) : [],
    plans: plansRaw ? (Array.isArray(plansRaw) ? plansRaw : plansRaw.data) : [],
    subscription: subscription ?? null,
    subPlans: subPlans ?? [],
  }
}

export async function deleteSubscriptionPaymentAction(
  gymId: string,
  paymentId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError<unknown>(`/payments/${paymentId}`, token, { method: 'DELETE' })
  if ('error' in result) return { error: result.error }
  updateTag(`admin-gym-${gymId}`)
  updateTag(`admin-gym-${gymId}-subscription`)
  updateTag('admin-gyms')
  return {}
}
