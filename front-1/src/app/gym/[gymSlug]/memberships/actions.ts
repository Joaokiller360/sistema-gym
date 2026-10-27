'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import { apiFetch, apiFetchWithError } from '@/lib/api'
import { getT } from '@/i18n/server'
import { membershipsMessages } from './messages'

const messages = async () => (await getT(membershipsMessages)).actions

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function suspendMembershipAction(gymSlug: string, id: string) {
  const token = await getToken()
  await apiFetch(`/memberships/${id}/suspend`, token, { method: 'PATCH' })
  updateTag(`memberships-${gymSlug}`)
}

export async function freezeMembershipAction(gymSlug: string, id: string) {
  const token = await getToken()
  await apiFetch(`/memberships/${id}/freeze`, token, { method: 'PATCH' })
  updateTag(`memberships-${gymSlug}`)
}

export async function cancelMembershipAction(gymSlug: string, id: string): Promise<{ error?: string }> {
  const token = await getToken()
  console.log('[cancelMembershipAction] id:', id, 'gymSlug:', gymSlug, 'hasToken:', !!token)
  const res = await apiFetch(`/memberships/${id}/cancel`, token, { method: 'PATCH' })
  console.log('[cancelMembershipAction] response:', JSON.stringify(res))
  if (res === null) return { error: (await messages()).cancelFailed }
  updateTag(`memberships-${gymSlug}`)
  return {}
}

export async function cancelMembershipWithPaymentsAction(
  gymSlug: string,
  membershipId: string,
  memberId: string,
): Promise<{ error?: string }> {
  const token = await getToken()

  const cancelResult = await apiFetch(`/memberships/${membershipId}/cancel`, token, { method: 'PATCH' })
  if (cancelResult === null) return { error: (await messages()).cancelFailed }

  type PaymentRef = { id: string; membershipId: string | null }
  const payments = await apiFetch<PaymentRef[] | { data: PaymentRef[] }>(`/payments?memberId=${memberId}&membershipId=${membershipId}`, token)
  const all = Array.isArray(payments) ? payments : (payments as { data: PaymentRef[] } | null)?.data ?? []
  // Never trust the filter alone: only this membership's payments may be deleted
  const list = all.filter(p => p.membershipId === membershipId)
  if (list.length) {
    await Promise.all(list.map(p => apiFetch(`/payments/${p.id}`, token, { method: 'DELETE' })))
  }

  updateTag(`memberships-${gymSlug}`)
  updateTag(`member-${memberId}`)
  updateTag(`member-${memberId}-payments`)
  updateTag(`member-${memberId}-memberships`)
  updateTag(`attendance-${gymSlug}`)
  return {}
}

export async function unfreezeMembershipAction(gymSlug: string, id: string) {
  const token = await getToken()
  await apiFetch(`/memberships/${id}/unfreeze`, token, { method: 'PATCH' })
  updateTag(`memberships-${gymSlug}`)
}

export async function changePlanAction(
  gymSlug: string,
  membershipId: string,
  planId: string,
  method: string = 'CASH',
): Promise<{ error?: string }> {
  const token = await getToken()
  const res = await apiFetch(
    `/memberships/${membershipId}/change-plan`,
    token,
    { method: 'POST', body: JSON.stringify({ planId, method }) },
  )
  if (res === null) return { error: (await messages()).changeFailed }
  updateTag(`memberships-${gymSlug}`)
  return {}
}

// ── Detail panel ────────────────────────────────────────────

export interface MembershipVisitDay {
  /** Check-in that consumed the visit */
  attendanceId: string
  /** Other entries the same day (re-entries); they must go too for the day to come back */
  extraIds: string[]
  checkIn: string
}

export interface MembershipPaymentRow {
  id: string
  amount: number
  currency: string
  method: string
  createdAt: string
}

export interface MembershipDetail {
  visits: MembershipVisitDay[]
  payments: MembershipPaymentRow[]
}

const UUID_RE = /^[0-9a-f-]{36}$/i

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** Lazy data for the memberships side panel: days consumed by this membership and its payments. */
export async function getMembershipDetailAction(
  gymSlug: string,
  membershipId: string,
  memberId: string,
  startDate: string,
): Promise<MembershipDetail> {
  if (!UUID_RE.test(membershipId) || !UUID_RE.test(memberId)) return { visits: [], payments: [] }
  const token = await getToken()
  const headers = { 'x-gym-slug': gymSlug }
  const since = startDate.slice(0, 10)
  type AttendanceRow = { id: string; checkIn: string; membershipId: string | null }
  type PaymentRow = MembershipPaymentRow & { membershipId: string | null }
  const [attendance, payments] = await Promise.all([
    apiFetch<AttendanceRow[]>(`/attendance?memberId=${memberId}&startDate=${since}`, token, { headers, silent: true }),
    apiFetch<PaymentRow[]>(`/payments?memberId=${memberId}&membershipId=${membershipId}`, token, { headers, silent: true }),
  ])

  const rows = attendance ?? []
  const visits = rows
    .filter(a => a.membershipId === membershipId)
    .map(a => ({
      attendanceId: a.id,
      checkIn: a.checkIn,
      extraIds: rows.filter(o => o.id !== a.id && dayKey(o.checkIn) === dayKey(a.checkIn)).map(o => o.id),
    }))
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn))

  return {
    visits,
    payments: (payments ?? [])
      .filter(p => p.membershipId === membershipId)
      .map(({ id, amount, currency, method, createdAt }) => ({ id, amount, currency, method, createdAt })),
  }
}

/**
 * Gives a consumed visit back by deleting that day's check-in(s). Payments are not
 * touched, so cash cuts and income reports stay the same.
 */
export async function restoreVisitDayAction(
  gymSlug: string,
  memberId: string,
  day: Pick<MembershipVisitDay, 'attendanceId' | 'extraIds'>,
): Promise<{ error?: string }> {
  const ids = [...day.extraIds, day.attendanceId]
  if (!ids.every(id => UUID_RE.test(id))) return { error: (await messages()).badRecord }
  const token = await getToken()
  const headers = { 'x-gym-slug': gymSlug }
  // Re-entries first: deleting the consuming check-in last is what returns the visit
  for (const id of ids) {
    const res = await apiFetchWithError(`/attendance/${id}`, token, { method: 'DELETE', headers })
    if ('error' in res) return { error: res.error }
  }
  updateTag(`memberships-${gymSlug}`)
  updateTag(`attendance-${gymSlug}`)
  updateTag(`member-${memberId}`)
  updateTag(`member-${memberId}-memberships`)
  return {}
}
