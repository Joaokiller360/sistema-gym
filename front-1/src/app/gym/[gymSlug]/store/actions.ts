'use server'

import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch, apiFetchWithError } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

// ── Products ───────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(200).optional().or(z.literal('')),
  price: z.number().int().min(1),
  cost: z.number().int().min(0).optional(),
  stock: z.number().int().min(0),
  category: z.string().max(40).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
})

export type ProductInput = z.infer<typeof productSchema>

export async function createProductAction(gymSlug: string, data: ProductInput): Promise<{ error?: string }> {
  const parsed = productSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const token = await getToken()
  const payload = {
    ...parsed.data,
    description: parsed.data.description || undefined,
    category: parsed.data.category || undefined,
  }

  const result = await apiFetchWithError('/store/products', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(payload),
  })

  if ('error' in result) return { error: result.error }
  revalidateTag(`store-products-${gymSlug}`, 'default')
  return {}
}

export async function updateProductAction(gymSlug: string, id: string, data: ProductInput): Promise<{ error?: string }> {
  const parsed = productSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const token = await getToken()
  const payload = {
    ...parsed.data,
    description: parsed.data.description || undefined,
    category: parsed.data.category || undefined,
  }

  const result = await apiFetchWithError(`/store/products/${id}`, token, {
    method: 'PATCH',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(payload),
  })

  if ('error' in result) return { error: result.error }
  revalidateTag(`store-products-${gymSlug}`, 'default')
  return {}
}

export async function deleteProductAction(gymSlug: string, id: string): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/store/products/${id}`, token, {
    method: 'DELETE',
    headers: { 'x-gym-slug': gymSlug },
  })
  if (result === null) return { error: 'Error al eliminar producto' }
  revalidateTag(`store-products-${gymSlug}`, 'default')
  return {}
}

// ── Sales ──────────────────────────────────────────────────

export async function createSaleAction(
  gymSlug: string,
  data: { items: { productId: string; quantity: number }[]; method: string; notes?: string },
): Promise<{ error?: string }> {
  if (!data.items.length) return { error: 'Seleccioná al menos un producto' }

  const token = await getToken()
  const result = await apiFetchWithError('/store/sales', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(data),
  })

  if ('error' in result) return { error: result.error }
  revalidateTag(`store-products-${gymSlug}`, 'default')
  revalidateTag(`store-sales-${gymSlug}`, 'default')
  return {}
}

// ── Member credits ──────────────────────────────────────────

export async function assignCreditsAction(
  gymSlug: string,
  data: { memberId: string; items: { productId: string; quantity: number }[]; notes?: string },
): Promise<{ error?: string }> {
  if (!data.items.length) return { error: 'Seleccioná al menos un producto' }

  const token = await getToken()
  const result = await apiFetchWithError('/store/credits', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(data),
  })

  if ('error' in result) return { error: result.error }
  revalidateTag(`store-credits-${data.memberId}`, 'default')
  return {}
}

export async function payCreditsAction(
  gymSlug: string,
  creditIds: string[],
  method: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError('/store/credits/pay', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify({ creditIds, method }),
  })

  if ('error' in result) return { error: result.error }
  revalidateTag(`store-credits-${gymSlug}`, 'default')
  return {}
}
