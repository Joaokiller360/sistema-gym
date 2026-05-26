'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'
import { apiFetchWithError, apiFetch } from '@/lib/api'
import { updateTag } from 'next/cache'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export type TicketPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | 'NOTIFICATION'
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type TicketCategory = 'BUG' | 'BILLING' | 'ACCESS' | 'FEATURE' | 'OTHER'

export interface SupportTicket {
  id: string
  title: string
  description: string
  priority: TicketPriority
  category: TicketCategory
  status: TicketStatus
  gymId: string
  gymName?: string
  gymSlug?: string
  createdByEmail?: string
  adminNotes?: string | null
  createdAt: string
  updatedAt: string
}

const createTicketSchema = z.object({
  title: z.string().min(5, 'Título muy corto').max(100),
  description: z.string().min(10, 'Descripción muy corta').max(2000),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW', 'NOTIFICATION']),
  category: z.enum(['BUG', 'BILLING', 'ACCESS', 'FEATURE', 'OTHER']),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>

export async function createTicketAction(
  gymSlug: string,
  data: CreateTicketInput,
): Promise<{ error?: string; ticket?: SupportTicket }> {
  const parsed = createTicketSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const token = await getToken()
  const result = await apiFetchWithError<SupportTicket>('/support/tickets', token, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
    headers: { 'x-gym-slug': gymSlug },
  })

  if ('error' in result) return { error: result.error }
  updateTag(`support-tickets-${gymSlug}`)
  updateTag('support-tickets-all')
  return { ticket: result.data }
}

export async function listGymTicketsAction(gymSlug: string): Promise<SupportTicket[]> {
  const token = await getToken()
  const data = await apiFetch<SupportTicket[] | { data: SupportTicket[] }>(
    '/support/tickets',
    token,
    {
      next: { tags: [`support-tickets-${gymSlug}`] },
      headers: { 'x-gym-slug': gymSlug },
    },
  )
  if (!data) return []
  return Array.isArray(data) ? data : data.data
}
