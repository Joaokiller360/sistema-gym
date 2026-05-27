import { cookies } from 'next/headers'

const BACKEND = process.env.API_URL ?? 'http://localhost:3001/api/v1'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const store = await cookies()
  const token = store.get('session')?.value ?? ''
  const { id } = await params

  const res = await fetch(`${BACKEND}/content/news/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return new Response(null, { status: res.status })
}
