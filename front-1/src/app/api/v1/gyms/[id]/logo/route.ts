import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { verifyToken } from '@/lib/auth'

const BACKEND = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const BACKEND_BASE = BACKEND.replace(/\/api\/v\d+$/, '')
const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies()
  const token = store.get('session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await verifyToken(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!SAFE_ID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const formData = await request.formData()

  const res = await fetch(`${BACKEND}/gyms/${id}/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = 'Error al subir el logo'
    try { msg = (JSON.parse(text) as { message?: string }).message ?? msg } catch { /* noop */ }
    return NextResponse.json({ error: msg }, { status: res.status })
  }

  const data = (await res.json().catch(() => ({}))) as { logoUrl?: string; url?: string; slug?: string }
  const raw = data.logoUrl ?? data.url ?? ''
  const logoUrl = raw.startsWith('/') ? `${BACKEND_BASE}${raw}` : raw
  // Expire now so the gym sidebar and the admin lists show the new logo on the next render
  if (data.slug) revalidateTag(`gym-${data.slug}`, { expire: 0 })
  revalidateTag('admin-gyms', { expire: 0 })
  revalidateTag(`admin-gym-${id}`, { expire: 0 })
  return NextResponse.json({ logoUrl })
}
