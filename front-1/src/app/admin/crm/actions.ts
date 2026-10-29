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
  /** The message this one quote-replies to */
  replyTo: { id: string; body: string; direction: 'IN' | 'OUT'; type: string } | null
}

export interface CrmThread extends Omit<CrmConversation, 'lastMessage' | 'gym'> {
  notes: string | null
  /** Replies skip the 1-minute undo queue */
  instantSend: boolean
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

export async function replyAction(id: string, body: string, replyToId?: string) {
  if (!body.trim()) return { error: 'Escribí un mensaje' }
  return post(`/admin/crm/conversations/${id}/messages`, { body, ...(replyToId && { replyToId }) })
}

/** Only while the reply is still queued (first minute) */
export async function editMessageAction(id: string, messageId: string, body: string) {
  if (!body.trim()) return { error: 'Escribí un mensaje' }
  return post(`/admin/crm/conversations/${id}/messages/${messageId}`, { body }, 'PATCH')
}

export async function deleteMessageAction(id: string, messageId: string) {
  return post(`/admin/crm/conversations/${id}/messages/${messageId}`, undefined, 'DELETE')
}

/** Skips what's left of the undo minute */
export async function sendNowAction(id: string, messageId: string) {
  return post(`/admin/crm/conversations/${id}/messages/${messageId}/send-now`)
}

export interface WaTemplate {
  name: string
  language: string
  category: string
  /** APPROVED, PENDING, REJECTED, PAUSED…: only APPROVED can be sent */
  status: string
  /** Header + body with {{n}} holes */
  preview: string
  params: number
  /** Why it can't be sent from the CRM, if it can't */
  unsupported: string | null
  /** What the CRM already knows for this contact, one per value ('' = to fill) */
  defaults: string[]
  /** Built-in send that uses it: contact/offer buttons or the automatic alerts */
  system: 'limitWarning' | 'limitReached' | 'contact' | 'offer' | null
}

export async function listTemplatesAction(conversationId: string): Promise<WaTemplate[] | { error: string }> {
  const res = await apiFetchWithError<WaTemplate[]>(`/admin/crm/templates?conversation=${encodeURIComponent(conversationId)}`, await token(), { cache: 'no-store' })
  return 'error' in res ? res : res.data
}

/** Goes to Meta's review; it can be sent once APPROVED */
export async function createTemplateAction(t: {
  name: string
  category: 'UTILITY' | 'MARKETING'
  language: string
  body: string
  examples: string[]
  footer?: string
}) {
  return post('/admin/crm/templates', t)
}

export async function deleteTemplateAction(name: string, language: string) {
  return post(`/admin/crm/templates/${encodeURIComponent(name)}?language=${encodeURIComponent(language)}`, undefined, 'DELETE')
}

export async function sendTemplateAction(id: string, t: { name: string; language: string; params: string[] }) {
  return post(`/admin/crm/conversations/${id}/templates`, t)
}

export interface QuickReply { id: string; label: string; text: string }

export async function listQuickRepliesAction(): Promise<QuickReply[] | { error: string }> {
  const res = await apiFetchWithError<QuickReply[]>('/admin/crm/quick-replies', await token(), { cache: 'no-store' })
  return 'error' in res ? res : res.data
}

export async function saveQuickReplyAction(data: { id?: string; label: string; text: string }) {
  const body = { label: data.label, text: data.text }
  return data.id ? post(`/admin/crm/quick-replies/${data.id}`, body, 'PATCH') : post('/admin/crm/quick-replies', body)
}

export async function deleteQuickReplyAction(id: string) {
  return post(`/admin/crm/quick-replies/${id}`, undefined, 'DELETE')
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

export type AwayMode = 'presence' | 'always'
export interface AwayConfig { enabled: boolean; message: string; mode: AwayMode }

/** Auto-reply while nobody has the CRM open (or always); fields left out keep their value */
export async function setAwayAction(data: Partial<AwayConfig>) {
  return post('/admin/crm/away', data, 'PATCH')
}

export async function sendContactTemplateAction(id: string, kind?: 'contact' | 'offer') {
  return post(`/admin/crm/conversations/${id}/template`, kind ? { kind } : {})
}

export async function updateConversationAction(id: string, data: { status?: CrmStatus; notes?: string; alias?: string; tags?: string[]; gymId?: string | null; instantSend?: boolean }) {
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

export interface CrmPlan { key: string; label: string; maxMembers: number | null; isActive: boolean }

export async function listPlansAction(): Promise<CrmPlan[]> {
  const res = await apiFetchWithError<CrmPlan[]>('/admin/subscription-plans', await token(), { cache: 'no-store' })
  return 'error' in res ? [] : res.data.filter(p => p.isActive)
}

export interface CreatedAccount {
  gymId: string
  slug: string
  email: string
  /** Shown once: the team passes it on if WhatsApp didn't */
  password: string
  whatsapp: { sent: boolean; error?: string } | null
}

/** Gym + owner login for this chat's contact; links the chat to the new gym */
export async function createAccountAction(
  id: string,
  data: { gymName: string; ownerName: string; email: string; plan?: string; sendWhatsapp: boolean },
): Promise<CreatedAccount | { error: string }> {
  const res = await apiFetchWithError<CreatedAccount>(`/admin/crm/conversations/${id}/account`, await token(), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if ('error' in res) return res
  refresh()
  return res.data
}

export interface CrmProduct {
  id: string
  name: string
  description: string | null
  /** In units (the back stores cents); null = "a consultar" */
  price: number | null
  currency: string
  /** /uploads/catalog/… */
  imageUrl: string | null
  active: boolean
}

export async function listProductsAction(): Promise<CrmProduct[] | { error: string }> {
  const res = await apiFetchWithError<CrmProduct[]>('/admin/crm/products', await token(), { cache: 'no-store' })
  return 'error' in res ? res : res.data
}

export async function saveProductAction(
  id: string | null,
  data: Partial<Pick<CrmProduct, 'name' | 'description' | 'price' | 'currency' | 'active'>>,
): Promise<CrmProduct | { error: string }> {
  const res = await apiFetchWithError<CrmProduct>(id ? `/admin/crm/products/${id}` : '/admin/crm/products', await token(), {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(data),
  })
  return 'error' in res ? res : res.data
}

export async function deleteProductAction(id: string) {
  return post(`/admin/crm/products/${id}`, undefined, 'DELETE')
}

/** Expects a `photo` field (JPG/PNG, already resized in the browser) */
export async function uploadProductPhotoAction(id: string, formData: FormData): Promise<{ imageUrl: string } | { error: string }> {
  const res = await fetch(`${API_URL}/admin/crm/products/${id}/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}` },
    body: formData,
  })
  const data = (await res.json().catch(() => null)) as { imageUrl?: string; message?: string | string[] } | null
  if (!res.ok || !data?.imageUrl) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message
    return { error: msg ?? 'No se pudo subir la foto' }
  }
  return { imageUrl: data.imageUrl }
}

export async function removeProductPhotoAction(id: string) {
  return post(`/admin/crm/products/${id}/photo`, undefined, 'DELETE')
}

/** Photo + description into the chat (text only without a photo) */
export async function sendProductAction(conversationId: string, productId: string, replyToId?: string) {
  return post(`/admin/crm/conversations/${conversationId}/products/${productId}`, replyToId ? { replyToId } : {})
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
