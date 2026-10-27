'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { refresh } from 'next/cache'
import { apiFetchWithError } from '@/lib/api'

export type CrmStatus = 'OPEN' | 'PENDING' | 'CLOSED'

export interface CrmGymRef { id: string; name: string; slug: string; logoUrl: string | null }

export interface CrmConversation {
  id: string
  phone: string
  contactName: string | null
  status: CrmStatus
  unreadCount: number
  lastMessageAt: string
  lastInboundAt: string | null
  gym: CrmGymRef | null
  lastMessage: { body: string; direction: 'IN' | 'OUT'; status: string | null; createdAt: string } | null
}

export interface CrmList { data: CrmConversation[]; counts: Partial<Record<CrmStatus, number>> }

export interface CrmMessage {
  id: string
  direction: 'IN' | 'OUT'
  body: string
  type: string
  status: string | null
  error: string | null
  /** Local copy of the attachment (sticker, photo, audio…) */
  mediaUrl: string | null
  sentById: string | null
  createdAt: string
}

export interface CrmThread extends Omit<CrmConversation, 'lastMessage' | 'gym'> {
  notes: string | null
  windowOpen: boolean
  messages: CrmMessage[]
  gym: (CrmGymRef & {
    subscriptionPlan: string
    subscriptionStatus: string
    owner: { name: string; email: string } | null
    members: number
    plan: { label: string; maxMembers: number | null } | null
  }) | null
}

async function token() {
  return (await cookies()).get('session')?.value ?? ''
}

export async function listConversationsAction(status: CrmStatus | 'ALL', q = ''): Promise<CrmList | { error: string }> {
  const params = new URLSearchParams({ status, ...(q.trim() && { q: q.trim() }) })
  const res = await apiFetchWithError<CrmList>(`/admin/crm/conversations?${params}`, await token(), { cache: 'no-store' })
  return 'error' in res ? res : res.data
}

export async function getConversationAction(id: string): Promise<CrmThread | { error: string }> {
  const res = await apiFetchWithError<CrmThread>(`/admin/crm/conversations/${id}`, await token(), { cache: 'no-store' })
  return 'error' in res ? res : res.data
}

async function post(path: string, body?: unknown, method = 'POST') {
  const res = await apiFetchWithError<unknown>(path, await token(), {
    method,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })
  return 'error' in res ? { error: res.error } : {}
}

export async function markReadAction(id: string) {
  const res = await post(`/admin/crm/conversations/${id}/read`)
  // Sidebar badge counts unread threads
  if (!res.error) refresh()
  return res
}

export async function replyAction(id: string, body: string) {
  if (!body.trim()) return { error: 'Escribí un mensaje' }
  return post(`/admin/crm/conversations/${id}/messages`, { body })
}

export async function sendContactTemplateAction(id: string) {
  return post(`/admin/crm/conversations/${id}/template`)
}

export async function updateConversationAction(id: string, data: { status?: CrmStatus; notes?: string; gymId?: string | null }) {
  const res = await post(`/admin/crm/conversations/${id}`, data, 'PATCH')
  if (!res.error && data.status) refresh()
  return res
}

export async function deleteConversationAction(id: string) {
  const res = await post(`/admin/crm/conversations/${id}`, undefined, 'DELETE')
  // Sidebar badge counts unread threads
  if (!res.error) refresh()
  return res
}

/** From a gym's page: open (or create) its thread and jump to it. */
export async function startConversationAction(gymId: string): Promise<{ error: string }> {
  const res = await apiFetchWithError<{ id: string }>('/admin/crm/conversations', await token(), {
    method: 'POST',
    body: JSON.stringify({ gymId }),
  })
  if ('error' in res) return res
  redirect(`/admin/crm?c=${res.data.id}`)
}
