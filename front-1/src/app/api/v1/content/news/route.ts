import { cookies } from 'next/headers'
import { sanitizeShortText, sanitizeText } from '@/lib/sanitize'

const BACKEND = process.env.API_URL ?? 'http://localhost:3001/api/v1'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function GET() {
  const token = await getToken()
  const res = await fetch(`${BACKEND}/content/news`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.text()
  return new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } })
}

export async function POST(request: Request) {
  const token = await getToken()
  const raw = await request.json()
  const title = sanitizeShortText(raw?.title)
  const body = sanitizeText(raw?.body)
  if (!title || !body) return new Response('Bad Request', { status: 400 })

  const res = await fetch(`${BACKEND}/content/news`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body }),
  })
  const data = await res.text()
  return new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } })
}
