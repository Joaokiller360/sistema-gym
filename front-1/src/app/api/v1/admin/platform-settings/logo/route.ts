import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const BACKEND = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const BACKEND_BASE = BACKEND.replace(/\/api\/v\d+$/, '')

export async function POST(request: Request) {
  const store = await cookies()
  const token = store.get('session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await verifyToken(token)
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()

  const res = await fetch(`${BACKEND}/admin/platform-settings/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = 'Error al subir la imagen'
    try { msg = (JSON.parse(text) as { message?: string }).message ?? msg } catch { /* noop */ }
    return NextResponse.json({ error: msg }, { status: res.status })
  }

  const data = (await res.json().catch(() => ({}))) as { logoUrl?: string; url?: string }
  const raw = data.logoUrl ?? data.url ?? ''
  const logoUrl = raw.startsWith('/') ? `${BACKEND_BASE}${raw}` : raw
  return NextResponse.json({ logoUrl })
}
