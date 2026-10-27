'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { apiFetch, apiFetchWithError } from '@/lib/api'
import { getT } from '@/i18n/server'
import { attendanceMessages } from './messages'

const messages = async () => (await getT(attendanceMessages)).actions

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function checkInAction(
  gymSlug: string,
  memberId: string,
  groupId?: string,
): Promise<{ error?: string; visitsRemaining?: number | null }> {
  if (!memberId.trim()) return { error: (await messages()).memberIdRequired }
  const token = await getToken()
  const result = await apiFetchWithError<{ visitsRemaining: number | null }>('/attendance/checkin', token, {
    method: 'POST',
    body: JSON.stringify({ memberId, ...(groupId ? { groupId } : {}) }),
    headers: { 'x-gym-slug': gymSlug },
  })
  if ('error' in result) {
    const t = await messages()
    const lower = result.error.toLowerCase()
    const msg = lower.includes('already checked in')
      ? t.alreadyCheckedIn
      : lower.includes('no active membership')
      ? t.noActiveMembership
      : result.error
    return { error: msg }
  }
  updateTag(`attendance-${gymSlug}`)
  return { visitsRemaining: result.data.visitsRemaining }
}

export async function checkOutAction(
  gymSlug: string,
  memberId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch('/attendance/checkout', token, {
    method: 'POST',
    body: JSON.stringify({ memberId }),
    headers: { 'x-gym-slug': gymSlug },
  })
  if (!result) return { error: (await messages()).checkOutFailed }
  updateTag(`attendance-${gymSlug}`)
  return {}
}

export async function deleteAttendanceAction(
  gymSlug: string,
  attendanceId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/attendance/${attendanceId}`, token, {
    method: 'DELETE',
    headers: { 'x-gym-slug': gymSlug },
  })
  if (result === null) return { error: (await messages()).deleteFailed }
  updateTag(`attendance-${gymSlug}`)
  return {}
}

export async function createGroupAction(
  gymSlug: string,
  name: string,
): Promise<{ error?: string }> {
  if (!name.trim()) return { error: (await messages()).nameRequired }
  const token = await getToken()
  const result = await apiFetch('/attendance/groups', token, {
    method: 'POST',
    body: JSON.stringify({ name: name.trim() }),
    headers: { 'x-gym-slug': gymSlug },
  })
  if (!result) return { error: (await messages()).createGroupFailed }
  updateTag(`attendance-groups-${gymSlug}`)
  return {}
}

export async function deleteGroupAction(
  gymSlug: string,
  groupId: string,
): Promise<{ error?: string }> {
  const token = await getToken()
  const result = await apiFetch(`/attendance/groups/${groupId}`, token, {
    method: 'DELETE',
    headers: { 'x-gym-slug': gymSlug },
  })
  if (result === null) return { error: (await messages()).deleteGroupFailed }
  updateTag(`attendance-groups-${gymSlug}`)
  return {}
}
