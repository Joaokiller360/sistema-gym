'use server'

import { cookies } from 'next/headers'
import { apiFetchWithError } from '@/lib/api'
import { sanitize } from '@/lib/input-validation'

export type SendFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'CUSTOM'

export async function sendComunicacionAction(payload: {
  filter: SendFilter
  gymIds: string[]
  subject: string
  body: string
  senderName: string
}): Promise<{ error?: string; sent?: number; failed?: number }> {
  const { filter, gymIds, subject, body, senderName } = payload

  // Size guard
  if (JSON.stringify(payload).length > 10_000) return { error: 'Contenido demasiado largo' }

  // Sender name
  const cleanSender = sanitize(senderName.trim(), 'name')
  if (cleanSender.length < 2 || cleanSender.length > 60) return { error: 'Nombre del remitente inválido' }

  // Validate filter
  if (!['ALL', 'ACTIVE', 'INACTIVE', 'CUSTOM'].includes(filter)) return { error: 'Filtro inválido' }

  // Sanitize subject
  const cleanSubject = sanitize(subject.trim(), 'text')
  if (cleanSubject.length < 5 || cleanSubject.length > 150) return { error: 'Asunto inválido (5-150 caracteres)' }

  // Sanitize body — strip HTML tags and dangerous sequences
  const cleanBody = body
    .replace(/<[^>]*>/g, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
  if (cleanBody.length < 10 || cleanBody.length > 3000) return { error: 'Mensaje inválido (10-3000 caracteres)' }

  // CUSTOM requires at least one gymId
  if (filter === 'CUSTOM' && gymIds.length === 0) return { error: 'Seleccioná al menos un gimnasio' }

  // gymIds: only UUIDs allowed
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (gymIds.some(id => !UUID_RE.test(id))) return { error: 'IDs de gimnasio inválidos' }
  if (gymIds.length > 500) return { error: 'Demasiados destinatarios personalizados' }

  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const result = await apiFetchWithError<{ sent: number; failed: number }>(
    '/admin/comunicaciones/send',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ filter, gymIds, subject: cleanSubject, body: cleanBody, senderName: cleanSender }),
    },
  )

  if ('error' in result) return { error: result.error }
  return { sent: result.data.sent, failed: result.data.failed }
}
