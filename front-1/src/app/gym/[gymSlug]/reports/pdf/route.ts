import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

const BACKEND = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

// Proxies the monthly PDF report from the backend so the session cookie never leaves this origin.
export async function GET(request: NextRequest, { params }: { params: Promise<{ gymSlug: string }> }) {
  const token = (await cookies()).get('session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gymSlug } = await params
  const month = request.nextUrl.searchParams.get('month') ?? ''
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: 'Mes inválido' }, { status: 400 })

  const res = await fetch(`${BACKEND}/reports/advanced/pdf?month=${month}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-gym-slug': gymSlug },
    cache: 'no-store',
  })
  if (!res.ok || !res.body) {
    const error = res.status === 404
      ? 'El servidor todavía no tiene la exportación a PDF (falta desplegar el backend)'
      : res.status === 403
        ? 'Los reportes avanzados no están disponibles en tu plan'
        : 'No se pudo generar el PDF'
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
