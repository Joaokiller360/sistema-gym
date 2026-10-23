'use server'

import { cookies } from 'next/headers'
import { apiFetchWithError } from '@/lib/api'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export async function emailMonthlyReport(
  gymSlug: string,
  month: string,
): Promise<{ sentTo: string } | { error: string }> {
  if (!MONTH_RE.test(month)) return { error: 'Mes inválido' }
  const token = (await cookies()).get('session')?.value ?? ''

  const res = await apiFetchWithError<{ sentTo: string }>(`/reports/advanced/pdf/email?month=${month}`, token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
  })
  return 'error' in res ? { error: res.error } : res.data
}
