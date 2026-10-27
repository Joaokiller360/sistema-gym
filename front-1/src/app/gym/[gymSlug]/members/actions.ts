'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { z } from 'zod'
import { apiFetch, apiFetchWithError } from '@/lib/api'
import type { WalletPassInfo } from './[id]/wallet-actions'
import { getT } from '@/i18n/server'
import { commonMessages } from '@/i18n/common'
import { membersMessages } from './messages'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}


const createMemberSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().max(10).regex(/^\d*$/, 'Solo números').optional().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
})

export type CreateMemberInput = z.infer<typeof createMemberSchema>

export async function createMemberAction(
  gymSlug: string,
  data: CreateMemberInput,
): Promise<{ error: string } | { memberId: string }> {
  const parsed = createMemberSchema.safeParse(data)
  if (!parsed.success) return { error: (await getT(commonMessages)).invalidData }

  const token = await getToken()
  const phone = parsed.data.phone?.trim()
  const birthDate = parsed.data.birthDate?.trim()

  const payload = {
    firstName: parsed.data.firstName.trim(),
    lastName: parsed.data.lastName.trim(),
    email: parsed.data.email.trim().toLowerCase(),
    ...(phone && phone.length >= 7 ? { phone } : {}),
    ...(birthDate ? { birthDate: new Date(birthDate).toISOString() } : {}),
  }

  const result = await apiFetchWithError<{ id: string }>('/members', token, {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
    body: JSON.stringify(payload),
  })

  if ('error' in result) {
    const t = (await getT(membersMessages)).actions
    const raw = result.error.toLowerCase()
    if (raw.includes('already') || raw.includes('duplicate') || raw.includes('exist') || raw.includes('único') || raw.includes('unique') || raw.includes('409')) {
      return { error: t.duplicate }
    }
    if (raw === 'internal server error' || raw === 'error 500') {
      return { error: t.serverError }
    }
    return { error: result.error }
  }

  updateTag(`members-${gymSlug}`)
  return { memberId: result.data.id }
}

export interface MemberPanelData {
  /** Check-in timestamps of the last 28 days */
  checkIns: string[]
  wallet: WalletPassInfo | null
}

/** Lazy data for the members list side panel (attendance heatmap + Wallet pass status). */
export async function getMemberPanelAction(gymSlug: string, memberId: string): Promise<MemberPanelData> {
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) return { checkIns: [], wallet: null }
  const token = await getToken()
  const headers = { 'x-gym-slug': gymSlug }
  const since = new Date(Date.now() - 27 * 86_400_000).toISOString().slice(0, 10)
  const [attendance, wallet] = await Promise.all([
    apiFetch<{ checkIn: string }[]>(`/attendance?memberId=${memberId}&startDate=${since}`, token, { headers, silent: true }),
    apiFetch<WalletPassInfo>(`/wallet/members/${memberId}/pass`, token, { headers, silent: true }),
  ])
  return { checkIns: (attendance ?? []).map(a => a.checkIn), wallet: wallet ?? null }
}
