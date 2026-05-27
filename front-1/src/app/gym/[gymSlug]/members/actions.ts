'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch, apiFetchWithError } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

// In-flight dedup: key → timestamp. Blocks concurrent identical requests within 10s.
const inFlight = new Map<string, number>()
const DEDUP_TTL = 10_000

function acquireDedup(key: string): boolean {
  const now = Date.now()
  const last = inFlight.get(key)
  if (last && now - last < DEDUP_TTL) return false
  inFlight.set(key, now)
  return true
}

function releaseDedup(key: string) {
  inFlight.delete(key)
}

const createMemberSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().max(10).regex(/^\d*$/, 'Solo números').optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
})

export type CreateMemberInput = z.infer<typeof createMemberSchema>

export async function createMemberAction(
  gymSlug: string,
  data: CreateMemberInput,
): Promise<{ error: string } | { memberId: string }> {
  const parsed = createMemberSchema.safeParse(data)
  if (!parsed.success) return { error: 'Datos inválidos' }

  const token = await getToken()
  const phone = parsed.data.phone?.trim()
  const birthDate = parsed.data.birthDate?.trim()

  const payload = {
    firstName: parsed.data.firstName.trim(),
    lastName: parsed.data.lastName.trim(),
    email: parsed.data.email.trim().toLowerCase(),
    ...(phone && phone.length >= 7 ? { phone } : {}),
    ...(birthDate ? { birthDate: new Date(birthDate).toISOString() } : {}),
  }

  const nameKey = `${gymSlug}:${payload.firstName.toLowerCase()}:${payload.lastName.toLowerCase()}`
  const emailKey = `${gymSlug}:${payload.email}`

  if (!acquireDedup(nameKey)) return { error: 'Ya existe un miembro con ese nombre y apellido' }
  if (!acquireDedup(emailKey)) { releaseDedup(nameKey); return { error: 'Ya existe un miembro con ese correo electrónico' } }

  try {
    const existing = await apiFetch<{ id: string; firstName: string; lastName: string; email: string }[]>('/members', token, {
      cache: 'no-store',
      headers: { 'x-gym-slug': gymSlug },
    })
    if (existing) {
      const normalizedName = `${payload.firstName.toLowerCase()} ${payload.lastName.toLowerCase()}`
      if (existing.some(m => `${m.firstName.toLowerCase()} ${m.lastName.toLowerCase()}` === normalizedName)) {
        return { error: 'Ya existe un miembro con ese nombre y apellido' }
      }
      if (existing.some(m => m.email.toLowerCase() === payload.email)) {
        return { error: 'Ya existe un miembro con ese correo electrónico' }
      }
    }

    const result = await apiFetchWithError<{ id: string }>('/members', token, {
      method: 'POST',
      headers: { 'x-gym-slug': gymSlug },
      body: JSON.stringify(payload),
    })

    if ('error' in result) {
      const raw = result.error.toLowerCase()
      if (raw.includes('already') || raw.includes('duplicate') || raw.includes('exist') || raw.includes('único') || raw.includes('unique')) {
        return { error: 'Ya existe un miembro con ese nombre o correo electrónico' }
      }
      if (raw === 'internal server error' || raw === 'error 500') {
        return { error: 'Error del servidor. Verificá los datos e intentá de nuevo.' }
      }
      return { error: result.error }
    }

    updateTag(`members-${gymSlug}`)
    return { memberId: result.data.id }
  } finally {
    releaseDedup(nameKey)
    releaseDedup(emailKey)
  }
}
