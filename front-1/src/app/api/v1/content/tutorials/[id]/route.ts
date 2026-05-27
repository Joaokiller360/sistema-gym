import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const BACKEND = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/

export async function DELETE(
  _request: Request,
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
  if (!SAFE_ID.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const res = await fetch(`${BACKEND}/content/tutorials/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return new Response(null, { status: res.status })
}
