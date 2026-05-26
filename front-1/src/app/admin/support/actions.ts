'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'
import { apiFetchWithError, apiFetch } from '@/lib/api'
import { updateTag } from 'next/cache'
import type { SupportTicket } from '@/app/gym/[gymSlug]/support/actions'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

export async function listAllTicketsAction(): Promise<SupportTicket[]> {
  const token = await getToken()
  const data = await apiFetch<SupportTicket[] | { data: SupportTicket[] }>(
    '/support/tickets?all=true',
    token,
    { next: { tags: ['support-tickets-all'] } },
  )
  if (!data) return []
  return Array.isArray(data) ? data : data.data
}

const updateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  adminNotes: z.string().max(2000).optional(),
})

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>

export async function updateTicketAction(
  ticketId: string,
  data: UpdateTicketInput,
): Promise<{ error?: string }> {
  const parsed = updateTicketSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const token = await getToken()
  const result = await apiFetchWithError(`/support/tickets/${ticketId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  })

  if ('error' in result) return { error: result.error }
  updateTag('support-tickets-all')
  return {}
}
