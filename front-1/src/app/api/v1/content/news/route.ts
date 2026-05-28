import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { sanitizeShortText, sanitizeText } from '@/lib/sanitize'

const BACKEND = process.env.API_URL ?? 'http://localhost:3001/api/v1'

async function getVerifiedUser() {
  const store = await cookies()
  const token = store.get('session')?.value
  if (!token) return null
  const session = await verifyToken(token)
  if (!session) return null
  return { token, session }
}

async function getVerifiedSuperAdmin() {
  const auth = await getVerifiedUser()
  if (!auth || auth.session.role !== 'SUPER_ADMIN') return null
  return auth
}

export async function GET() {
  const auth = await getVerifiedUser()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await fetch(`${BACKEND}/content/news`, {
    headers: { Authorization: `Bearer ${auth.token}` },
    cache: 'no-store',
  })
  const data = await res.text()
  return new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } })
}

export async function POST(request: Request) {
  const auth = await getVerifiedSuperAdmin()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await request.json()
  const title = sanitizeShortText(raw?.title)
  const body = sanitizeText(raw?.body)
  if (!title || !body) return new Response('Bad Request', { status: 400 })

  const res = await fetch(`${BACKEND}/content/news`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content: body }),
  })
  const data = await res.text()
  return new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } })
}
