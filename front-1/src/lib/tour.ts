'use server'

import { cookies } from 'next/headers'
import { apiFetchWithError } from '@/lib/api'

/** Marks the guided tour as seen so it no longer starts on its own. */
export async function completeTourAction(): Promise<void> {
  const token = (await cookies()).get('session')?.value
  if (!token) return
  await apiFetchWithError('/auth/me/tour', token, { method: 'POST' })
}
