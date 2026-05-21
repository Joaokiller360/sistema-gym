'use server'

import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'
import { apiFetch } from '@/lib/api'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function suspendMembershipAction(gymSlug: string, id: string) {
  const token = await getToken()
  await apiFetch(`/memberships/${id}/suspend`, token, { method: 'PATCH' })
  revalidateTag(`memberships-${gymSlug}`, 'default')
}

export async function freezeMembershipAction(gymSlug: string, id: string) {
  const token = await getToken()
  await apiFetch(`/memberships/${id}/freeze`, token, { method: 'PATCH' })
  revalidateTag(`memberships-${gymSlug}`, 'default')
}

export async function cancelMembershipAction(gymSlug: string, id: string) {
  const token = await getToken()
  await apiFetch(`/memberships/${id}/cancel`, token, { method: 'PATCH' })
  revalidateTag(`memberships-${gymSlug}`, 'default')
}

export async function cancelMembershipWithPaymentsAction(
  gymSlug: string,
  membershipId: string,
  memberId: string,
): Promise<{ error?: string }> {
  const token = await getToken()

  const cancelResult = await apiFetch(`/memberships/${membershipId}/cancel`, token, { method: 'PATCH' })
  if (!cancelResult && cancelResult !== '') return { error: 'Error al cancelar la membresía' }

  const payments = await apiFetch<{ id: string }[] | { data: { id: string }[] }>(`/payments?membershipId=${membershipId}`, token)
  const list = Array.isArray(payments) ? payments : (payments as { data: { id: string }[] } | null)?.data ?? []
  if (list.length) {
    await Promise.all(list.map(p => apiFetch(`/payments/${p.id}`, token, { method: 'DELETE' })))
  }

  revalidateTag(`memberships-${gymSlug}`, 'default')
  revalidateTag(`member-${memberId}-payments`, 'default')
  revalidateTag(`member-${memberId}-memberships`, 'default')
  return {}
}

export async function unfreezeMembershipAction(gymSlug: string, id: string) {
  const token = await getToken()
  await apiFetch(`/memberships/${id}/unfreeze`, token, { method: 'PATCH' })
  revalidateTag(`memberships-${gymSlug}`, 'default')
}
