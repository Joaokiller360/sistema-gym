'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { apiFetchWithError } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export interface WalletPassInfo {
  configured: boolean
  issued: boolean
  shareUrl: string | null
  googleSaveUrl: string | null
  issuedAt: string | null
}

export async function issueWalletPassAction(
  gymSlug: string,
  memberId: string,
  sendEmail: boolean,
): Promise<{ error?: string; shareUrl?: string; emailSent?: boolean }> {
  const result = await apiFetchWithError<{ shareUrl: string; emailSent: boolean }>(
    `/wallet/members/${memberId}/pass`,
    await getToken(),
    { method: 'POST', headers: { 'x-gym-slug': gymSlug }, body: JSON.stringify({ sendEmail }) },
  )
  if ('error' in result) return { error: result.error }
  updateTag(`member-${memberId}-wallet`)
  return { shareUrl: result.data.shareUrl, emailSent: result.data.emailSent }
}

export async function emailWalletPassAction(gymSlug: string, memberId: string): Promise<{ error?: string; emailSent?: boolean }> {
  const result = await apiFetchWithError<{ emailSent: boolean }>(`/wallet/members/${memberId}/pass/email`, await getToken(), {
    method: 'POST',
    headers: { 'x-gym-slug': gymSlug },
  })
  if ('error' in result) return { error: result.error }
  return { emailSent: result.data.emailSent }
}

export async function revokeWalletPassAction(gymSlug: string, memberId: string): Promise<{ error?: string }> {
  const result = await apiFetchWithError(`/wallet/members/${memberId}/pass`, await getToken(), {
    method: 'DELETE',
    headers: { 'x-gym-slug': gymSlug },
  })
  if ('error' in result) return { error: result.error }
  updateTag(`member-${memberId}-wallet`)
  return {}
}
