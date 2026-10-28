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
  /** Name the team gave the contact */
  alias: string | null
  tags: string[]
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

/** Only while the reply is still queued (first minute) */
export async function editMessageAction(id: string, messageId: string, body: string) {
  if (!body.trim()) return { error: 'Escribí un mensaje' }
  return post(`/admin/crm/conversations/${id}/messages/${messageId}`, { body }, 'PATCH')
}

export async function deleteMessageAction(id: string, messageId: string) {
  return post(`/admin/crm/conversations/${id}/messages/${messageId}`, undefined, 'DELETE')
}

/** Holds the automatic plan-limit alerts back (e.g. while a template is pending approval) */
export async function setAlertsPausedAction(paused: boolean) {
  return post('/admin/crm/alerts', { paused }, 'PATCH')
}

/** contact = existing customer, offer = sales pitch; the back picks one by default */
export interface WaProfile { profilePictureUrl: string | null; about: string | null }

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1'

/** Photo the gyms see on the business WhatsApp number. Expects a `photo` field (JPG/PNG). */
export async function setWaProfilePhotoAction(formData: FormData): Promise<WaProfile | { error: string }> {
  const res = await fetch(`${API_URL}/admin/crm/profile/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}` },
    body: formData,
  })
  const data = (await res.json().catch(() => null)) as (WaProfile & { message?: string | string[] }) | null
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message
    return { error: msg ?? 'No se pudo cambiar la foto' }
  }
  return { profilePictureUrl: data?.profilePictureUrl ?? null, about: data?.about ?? null }
}

export async function sendContactTemplateAction(id: string, kind?: 'contact' | 'offer') {
  return post(`/admin/crm/conversations/${id}/template`, kind ? { kind } : {})
}

export async function updateConversationAction(id: string, data: { status?: CrmStatus; notes?: string; alias?: string; tags?: string[]; gymId?: string | null }) {
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

/** Opens (or reuses) a thread with any number, e.g. a prospect. */
export async function createChatAction(phone: string, name: string): Promise<{ id: string } | { error: string }> {
  const res = await apiFetchWithError<{ id: string }>('/admin/crm/conversations', await token(), {
    method: 'POST',
    body: JSON.stringify({ phone, ...(name.trim() && { name: name.trim() }) }),
  })
  return 'error' in res ? res : { id: res.data.id }
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
