import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { getT } from '@/i18n/server'
import { reportsMessages } from '../messages'

const BACKEND = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

// Proxies the monthly PDF report from the backend so the session cookie never leaves this origin.
export async function GET(request: NextRequest, { params }: { params: Promise<{ gymSlug: string }> }) {
  const token = (await cookies()).get('session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gymSlug } = await params
  const month = request.nextUrl.searchParams.get('month') ?? ''
  const t = (await getT(reportsMessages)).actions
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: t.badMonth }, { status: 400 })

  const res = await fetch(`${BACKEND}/reports/advanced/pdf?month=${month}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-gym-slug': gymSlug },
    cache: 'no-store',
  })
  if (!res.ok || !res.body) {
    const error = res.status === 404
      ? t.pdfNotDeployed
      : res.status === 403
        ? t.pdfNotInPlan
        : t.pdfFailed
    return NextResponse.json({ error }, { status: res.status || 502 })
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-${gymSlug}-${month}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
