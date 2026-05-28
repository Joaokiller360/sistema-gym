'use server'

import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

const API_URL = process.env.API_URL ?? 'http://localhost:3001'

export interface RegisterPayload {
  ownerName: string
  email: string
  phone?: string
  country?: string
  gymName: string
  planId?: string
  isTrial?: boolean
}

export async function registerAction(
  data: RegisterPayload,
): Promise<{ gymSlug?: string; error?: string }> {
  if (!data.ownerName?.trim() || data.ownerName.trim().length < 2) return { error: 'Nombre requerido (mín. 2 caracteres)' }
  if (!data.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return { error: 'Email inválido' }
  if (!data.gymName?.trim() || data.gymName.trim().length < 2) return { error: 'Nombre del gimnasio requerido (mín. 2 caracteres)' }

  let token: string
  let gymSlug: string | null = null

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerName: data.ownerName.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim() || undefined,
        country: data.country?.trim() || undefined,
        gymName: data.gymName.trim(),
        planId: data.planId || undefined,
        isTrial: data.isTrial ?? false,
      }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const msg = body?.message
        ? Array.isArray(body.message) ? body.message[0] : String(body.message)
        : null

      if (res.status === 409) return { error: 'Ya existe una cuenta con ese email' }
      if (res.status === 422) return { error: msg ?? 'Datos inválidos' }
      return { error: msg ?? 'Error al crear la cuenta. Intentá de nuevo.' }
    }

    const body = await res.json()
    token = body.access_token ?? body.token
    gymSlug = body.gym?.slug ?? body.gymSlug ?? null

    if (!token) return { error: 'Error del servidor. Intentá de nuevo.' }
  } catch {
    return { error: 'Error de conexión. Verificá tu internet e intentá de nuevo.' }
  }

  const session = await verifyToken(token)
  if (!session) return { error: 'Sesión inválida. Intentá nuevamente.' }

  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(60, session.exp - Math.floor(Date.now() / 1000)),
  })

  return { gymSlug: gymSlug ?? session.gymSlug ?? undefined }
}
