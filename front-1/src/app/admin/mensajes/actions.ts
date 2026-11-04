'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetchWithError } from '@/lib/api'

async function getToken() {
  return (await cookies()).get('session')?.value ?? ''
}

const SAFE_ID = /^[0-9a-f-]{36}$/i

async function call(path: string, method: string, body?: unknown): Promise<{ error?: string }> {
  const result = await apiFetchWithError(path, await getToken(), {
    method,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })
  if ('error' in result) return { error: result.error }
  updateTag('admin-messaging')
  return {}
}

export async function setCostAction(costPerMessage: number) {
  if (!Number.isFinite(costPerMessage) || costPerMessage < 0 || costPerMessage > 10) return { error: 'Costo inválido' }
  return call('/admin/messaging/cost', 'PATCH', { costPerMessage })
}

const packSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre').max(60),
  messages: z.number().int().min(1, 'Cantidad de mensajes inválida').max(1_000_000),
  price: z.number().min(0.01, 'Precio inválido').max(1_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  billing: z.enum(['ONCE', 'MONTHLY']),
  planKeys: z.array(z.string().max(60)).min(1, 'Elige al menos un plan').max(50),
  isActive: z.boolean(),
})
export type PackInput = z.infer<typeof packSchema>

export async function savePackAction(id: string | null, data: PackInput) {
  const parsed = packSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }
  if (id && !SAFE_ID.test(id)) return { error: 'Pack inválido' }
  return id ? call(`/admin/messaging/packs/${id}`, 'PATCH', parsed.data) : call('/admin/messaging/packs', 'POST', parsed.data)
}

export async function togglePackAction(id: string, isActive: boolean) {
  if (!SAFE_ID.test(id)) return { error: 'Pack inválido' }
  return call(`/admin/messaging/packs/${id}`, 'PATCH', { isActive })
}

export async function deletePackAction(id: string) {
  if (!SAFE_ID.test(id)) return { error: 'Pack inválido' }
  return call(`/admin/messaging/packs/${id}`, 'DELETE')
}

export async function approvePurchaseAction(id: string, method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER') {
  if (!SAFE_ID.test(id)) return { error: 'Compra inválida' }
  const res = await call(`/admin/messaging/purchases/${id}/approve`, 'PATCH', { method })
  // The gym's balance changed
  if (!res.error) updateTag('admin-gyms')
  return res
}

export async function rejectPurchaseAction(id: string) {
  if (!SAFE_ID.test(id)) return { error: 'Compra inválida' }
  return call(`/admin/messaging/purchases/${id}/reject`, 'PATCH')
}

/** Voids a sale: monthly stops adding messages, one-time takes back the unused credits */
export async function cancelPurchaseAction(id: string) {
  if (!SAFE_ID.test(id)) return { error: 'Venta inválida' }
  const res = await call(`/admin/messaging/purchases/${id}/cancel`, 'PATCH')
  if (!res.error) updateTag('admin-gyms')
  return res
}

export async function deletePurchaseAction(id: string) {
  if (!SAFE_ID.test(id)) return { error: 'Venta inválida' }
  const res = await call(`/admin/messaging/purchases/${id}`, 'DELETE')
  if (!res.error) updateTag('admin-gyms')
  return res
}
