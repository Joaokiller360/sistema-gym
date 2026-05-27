import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/unauthorized', '/inicio', '/terminos']

const GYM_ROLES = ['GYM_OWNER', 'GYM_ADMIN', 'TRAINER', 'RECEPTIONIST'] as const

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/' || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const session = await verifyToken(token)
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname.startsWith('/admin')) {
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
    return NextResponse.next()
  }

  const gymSlugMatch = pathname.match(/^\/gym\/([^/]+)/)
  if (gymSlugMatch) {
    const urlSlug = gymSlugMatch[1]
    if (session.role === 'SUPER_ADMIN') return NextResponse.next()
    if (!GYM_ROLES.includes(session.role as typeof GYM_ROLES[number]) || session.gymSlug !== urlSlug) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
