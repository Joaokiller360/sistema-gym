'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { apiFetchWithError } from '@/lib/api'
import { getT } from '@/i18n/server'
import { attendanceMessages } from '../messages'

const messages = async () => (await getT(attendanceMessages)).scanActions

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export interface ScanResult {
  member: { id: string; firstName: string; lastName: string; photoUrl: string | null; isActive: boolean }
  membership: {
    active: boolean
    planName: string | null
    endDate: string | null
    /** Visit-limited plans only (null = unlimited) */
    visitsTotal: number | null
    visitsRemaining: number | null
  }
  checkedInToday: string | null
  pendingCredits: { count: number; total: number; currency: string }
}

type Item = { productId: string; quantity: number }

function codePath(code: string) {
  return `/wallet/scan/${encodeURIComponent(code.trim().slice(0, 80))}`
}

async function friendly(error: string) {
  const t = await messages()
  const lower = error.toLowerCase()
  if (lower.includes('already checked in')) return t.alreadyIn
  if (lower.includes('no active membership')) return t.noActive
  return error
}

export async function scanCodeAction(gymSlug: string, code: string): Promise<{ data?: ScanResult; error?: string }> {
  if (!code.trim()) return { error: (await messages()).emptyCode }
  const result = await apiFetchWithError<ScanResult>(codePath(code), await getToken(), {
    headers: { 'x-gym-slug': gymSlug },
  })
  if ('error' in result) return { error: await friendly(result.error) }
  return { data: result.data }
}

export async function scanCheckInAction(
  gymSlug: string,
  code: string,
): Promise<{ error?: string; visitsRemaining?: number | null }> {
  const result = await apiFetchWithError<{ visitsRemaining: number | null }>(`${codePath(code)}/checkin`, await getToken(), {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
  })
  if ('error' in result) return { error: await friendly(result.error) }
  updateTag(`attendance-${gymSlug}`)
  return { visitsRemaining: result.data.visitsRemaining }
}

export async function scanSaleAction(
  gymSlug: string,
  code: string,
  data: { items: Item[]; method: string; notes?: string },
): Promise<{ error?: string }> {
  if (!data.items.length) return { error: (await messages()).pickProduct }
  const result = await apiFetchWithError(`${codePath(code)}/sale`, await getToken(), {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(data),
  })
  if ('error' in result) return { error: await friendly(result.error) }
  updateTag(`store-products-${gymSlug}`)
  updateTag(`store-sales-${gymSlug}`)
  return {}
}

export async function scanCreditAction(
  gymSlug: string,
  code: string,
  memberId: string,
  data: { items: Item[]; notes?: string },
): Promise<{ error?: string }> {
  if (!data.items.length) return { error: (await messages()).pickProduct }
  const result = await apiFetchWithError(`${codePath(code)}/credit`, await getToken(), {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(data),
  })
  if ('error' in result) return { error: await friendly(result.error) }
  updateTag(`store-credits-${gymSlug}`)
  updateTag(`store-credits-${memberId}`)
  updateTag(`store-products-${gymSlug}`)
  return {}
}
