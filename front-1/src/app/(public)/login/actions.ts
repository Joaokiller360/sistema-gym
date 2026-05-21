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
      const body = await res.json().catch(() => ({}))
      return { error: body.message ?? 'Credenciales incorrectas' }
    }

    const body = await res.json()
    token = body.access_token ?? body.token
    if (!token) return { error: 'Respuesta inválida del servidor' }

    // Cache gym slug from response body as fallback if JWT doesn't include it
    gymSlugFromBody = body.gym?.slug ?? body.gymSlug ?? null
  } catch {
    return { error: 'Error de conexión con el servidor' }
  }

  const session = await verifyToken(token)
  if (!session) {
    return { error: 'Token inválido' }
  }

  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: session.exp - Math.floor(Date.now() / 1000),
  })

  if (session.role === 'SUPER_ADMIN') {
    redirect('/admin/dashboard')
  }

  const gymSlug = session.gymSlug ?? gymSlugFromBody
  if (!gymSlug) return { error: 'No se encontró el gimnasio asociado a tu cuenta' }

  redirect(`/gym/${gymSlug}/dashboard`)
}
