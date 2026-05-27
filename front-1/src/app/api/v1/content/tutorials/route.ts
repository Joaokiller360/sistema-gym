import { cookies } from 'next/headers'
import { sanitizeShortText } from '@/lib/sanitize'

const BACKEND = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const YOUTUBE_URL_RE = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_-]{11}/

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function GET() {
  const token = await getToken()
  const res = await fetch(`${BACKEND}/content/tutorials`, {
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
  const videoUrl = typeof raw?.videoUrl === 'string' ? raw.videoUrl.trim() : ''

  if (!title || !YOUTUBE_URL_RE.test(videoUrl)) {
    return new Response('Bad Request', { status: 400 })
  }

  const res = await fetch(`${BACKEND}/content/tutorials`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, videoUrl }),
  })
  const data = await res.text()
  return new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } })
}
