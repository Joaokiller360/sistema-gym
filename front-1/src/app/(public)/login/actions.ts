'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { verifyToken } from '@/lib/auth'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

type LoginInput = z.infer<typeof schema>

export async function loginAction(data: LoginInput): Promise<{ error: string }> {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    return { error: 'Datos inválidos' }
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  let token: string
  let gymSlugFromBody: string | null = null
  try {
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    })

    if (!res.ok) {
      const status = res.status
      if (status === 401 || status === 403) return { error: 'Credenciales incorrectas' }
      if (status >= 500) return { error: 'Error del servidor. Intentá más tarde.' }
      return { error: 'Credenciales incorrectas' }
    }

    const body = await res.json()
    token = body.access_token ?? body.token
    if (!token) return { error: 'Error del servidor. Intentá más tarde.' }

    // Cache gym slug from response body as fallback if JWT doesn't include it
    gymSlugFromBody = body.gym?.slug ?? body.gymSlug ?? null
  } catch {
    return { error: 'Error de conexión. Verificá tu internet e intentá de nuevo.' }
  }

  const session = await verifyToken(token)
  if (!session) {
    return { error: 'Sesión inválida. Intentá nuevamente.' }
  }

  if (session.role !== 'SUPER_ADMIN') {
    const gymSlug = session.gymSlug ?? gymSlugFromBody
    if (gymSlug) {
      const gymRes = await fetch(`${apiUrl}/gyms/${gymSlug}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        cache: 'no-store',
      }).catch(() => null)
      const gymData = gymRes?.ok ? await gymRes.json().catch(() => null) : null
      if (gymData && gymData.isActive === false) {
        return { error: 'El gimnasio está deshabilitado. Contactá al administrador.' }
      }
    }
  }

  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(60, session.exp - Math.floor(Date.now() / 1000)),
  })

  if (session.role === 'SUPER_ADMIN') {
    redirect('/admin/dashboard')
  }

  const gymSlug = session.gymSlug ?? gymSlugFromBody
  if (!gymSlug) return { error: 'No se encontró el gimnasio asociado a tu cuenta' }

  redirect(`/gym/${gymSlug}/dashboard`)
}
