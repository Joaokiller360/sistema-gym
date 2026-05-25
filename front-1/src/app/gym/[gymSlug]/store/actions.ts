'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
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
  imageUrl: z.string().url().optional().or(z.literal('')),
  price: z.number().min(0.01),
  cost: z.number().min(0).optional(),
  stock: z.number().int().min(0),
  categoryId: z.string().uuid().optional().or(z.literal('')),
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
    imageUrl: parsed.data.imageUrl || undefined,
    categoryId: parsed.data.categoryId || undefined,
    price: Math.round(parsed.data.price * 100),
    cost: parsed.data.cost != null ? Math.round(parsed.data.cost * 100) : undefined,
  }

  const result = await apiFetchWithError('/store/products', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(payload),
  })

  if ('error' in result) return { error: result.error }
  updateTag(`store-products-${gymSlug}`)
  return {}
}

export async function updateProductAction(gymSlug: string, id: string, data: ProductInput): Promise<{ error?: string }> {
  const parsed = productSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const token = await getToken()
  const payload = {
    ...parsed.data,
    description: parsed.data.description || undefined,
    imageUrl: parsed.data.imageUrl || undefined,
    categoryId: parsed.data.categoryId || undefined,
    price: Math.round(parsed.data.price * 100),
    cost: parsed.data.cost != null ? Math.round(parsed.data.cost * 100) : undefined,
  }

  const result = await apiFetchWithError(`/store/products/${id}`, token, {
    method: 'PATCH',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(payload),
  })

  if ('error' in result) return { error: result.error }
  updateTag(`store-products-${gymSlug}`)
  return {}
}

export async function deleteProductAction(gymSlug: string, id: string): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError(`/store/products/${id}`, token, {
    method: 'DELETE',
    headers: { 'x-gym-slug': gymSlug },
  })
  if ('error' in result) return { error: result.error }
  updateTag(`store-products-${gymSlug}`)
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
  updateTag(`store-products-${gymSlug}`)
  updateTag(`store-sales-${gymSlug}`)
  return {}
}

// ── Member credits ──────────────────────────────────────────

export interface MemberCreditRecord {
  id: string
  memberId: string
  productId: string
  quantity: number
  unitPrice: number
  notes: string | null
  isPaid: boolean
  createdAt: string
  product: { name: string; price: number }
}

export async function getMemberCreditsAction(gymSlug: string, memberId: string): Promise<MemberCreditRecord[]> {
  const token = await getToken()
  const result = await apiFetch<MemberCreditRecord[]>(`/store/credits/${memberId}`, token, {
    headers: { 'x-gym-slug': gymSlug },
  })
  return result ?? []
}

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
  updateTag(`store-credits-${gymSlug}`)
  updateTag(`store-credits-${data.memberId}`)
  updateTag(`store-products-${gymSlug}`)
  return {}
}

export async function payCreditsAction(
  gymSlug: string,
  creditIds: string[],
  method: string,
  memberId?: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError('/store/credits/pay', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify({ creditIds, method }),
  })

  if ('error' in result) return { error: result.error }
  updateTag(`store-credits-${gymSlug}`)
  updateTag(`store-sales-${gymSlug}`)
  if (memberId) updateTag(`store-credits-${memberId}`)
  return {}
}

export async function deleteSaleAction(gymSlug: string, id: string): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/store/sales/${id}`, token, {
    method: 'DELETE',
    headers: { 'x-gym-slug': gymSlug },
  })
  if (result === null) return { error: 'Error al eliminar la venta' }
  updateTag(`store-products-${gymSlug}`)
  updateTag(`store-sales-${gymSlug}`)
  return {}
}

// ── Categories ──────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1).max(60),
  imageUrl: z.string().url().optional().or(z.literal('')),
})

export type CategoryInput = z.infer<typeof categorySchema>

export async function createCategoryAction(gymSlug: string, data: CategoryInput): Promise<{ error?: string }> {
  const parsed = categorySchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }
  const token = await getToken()
  const result = await apiFetchWithError('/store/categories', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify({ ...parsed.data, imageUrl: parsed.data.imageUrl || undefined }),
  })
  if ('error' in result) return { error: result.error }
  updateTag(`store-categories-${gymSlug}`)
  return {}
}

export async function updateCategoryAction(gymSlug: string, id: string, data: CategoryInput): Promise<{ error?: string }> {
  const parsed = categorySchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }
  const token = await getToken()
  const result = await apiFetchWithError(`/store/categories/${id}`, token, {
    method: 'PATCH',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify({ ...parsed.data, imageUrl: parsed.data.imageUrl || undefined }),
  })
  if ('error' in result) return { error: result.error }
  updateTag(`store-categories-${gymSlug}`)
  return {}
}

export async function deleteCategoryAction(gymSlug: string, id: string): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetchWithError(`/store/categories/${id}`, token, {
    method: 'DELETE',
    headers: { 'x-gym-slug': gymSlug },
  })
  if ('error' in result) return { error: result.error }
  updateTag(`store-categories-${gymSlug}`)
  return {}
}
