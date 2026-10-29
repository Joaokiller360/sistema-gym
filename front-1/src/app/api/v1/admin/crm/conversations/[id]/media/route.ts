import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const BACKEND = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/

/** Photo/video for a CRM chat. A route, not a server action: videos go up to 16 MB, over the action body limit. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies()
  const token = store.get('session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await verifyToken(token)
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!SAFE_ID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const res = await fetch(`${BACKEND}/admin/crm/conversations/${id}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: await request.formData(),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = 'No se pudo enviar el archivo'
    try {
      const m = (JSON.parse(text) as { message?: string | string[] }).message
      msg = (Array.isArray(m) ? m[0] : m) ?? msg
    } catch { /* noop */ }
    return NextResponse.json({ error: msg }, { status: res.status })
  }
  return NextResponse.json(await res.json().catch(() => ({})))
}
