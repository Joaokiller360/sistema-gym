'use server'

import { cookies } from 'next/headers'
import { apiFetch, apiFetchWithError } from '@/lib/api'
import { sanitize } from '@/lib/input-validation'

async function getToken() {
  const store = await cookies()
  return store.get('session')?.value ?? ''
}

// Strip HTML tags and dangerous sequences from free text
function sanitizeMessage(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/javascript\s*:/gi, '')   // strip JS protocol
    .replace(/on\w+\s*=/gi, '')        // strip event handlers
    .replace(/['";][\s-]*(-{2}|\/\*)/g, '') // strip SQL comment openers after quotes
    .trim()
}

const SAFE_URL_RE = /^https:\/\/([\w-]+\.)+[\w-]+(\/[\w\-./?%&=+#@!~]*)?$/i

export async function updateAccessRequestStatusAction(
  id: string,
  status: 'PENDING' | 'CONTACTED' | 'DISMISSED',
): Promise<{ error?: string }> {
  if (!id || !['PENDING', 'CONTACTED', 'DISMISSED'].includes(status)) {
    return { error: 'Parámetros inválidos' }
  }
  const token = await getToken()
  const result = await apiFetch(`/access-requests/admin/${id}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  if (!result) return { error: 'Error al actualizar el estado' }
  return {}
}

export async function convertToGymAction(
  id: string,
  gymName: string,
): Promise<{ error?: string; gymSlug?: string }> {
  if (!id) return { error: 'ID inválido' }

  const clean = gymName.trim().replace(/[<>'"`;{}|\\^~$]/g, '')
  if (clean.length < 2 || clean.length > 80) return { error: 'Nombre del gimnasio inválido (2-80 caracteres)' }

  const token = await getToken()
  const result = await apiFetchWithError<{ gymSlug?: string }>(`/access-requests/admin/${id}/convert`, token, {
    method: 'POST',
    body: JSON.stringify({ gymName: clean }),
  })
  if ('error' in result) return { error: result.error }
  return { gymSlug: result.data?.gymSlug }
}

export async function sendAccessRequestMessageAction(
  id: string,
  message: string,
  meetingLink?: string,
): Promise<{ error?: string }> {
  if (!id) return { error: 'ID inválido' }

  // Payload size guard
  const rawSize = (message ?? '').length + (meetingLink ?? '').length
  if (rawSize > 5_000) return { error: 'Contenido demasiado largo' }

  // Message validation
  const cleanMessage = sanitizeMessage(message ?? '')
  if (cleanMessage.length < 5) return { error: 'Mensaje muy corto (mínimo 5 caracteres)' }
  if (cleanMessage.length > 2_000) return { error: 'Mensaje demasiado largo (máximo 2000 caracteres)' }

  // Meeting link validation
  let cleanLink: string | undefined
  if (meetingLink?.trim()) {
    cleanLink = sanitize(meetingLink.trim(), 'url')
    if (!SAFE_URL_RE.test(cleanLink)) {
      return { error: 'Link de reunión inválido (debe ser https://)' }
    }
    if (cleanLink.length > 500) return { error: 'Link demasiado largo' }
  }

  const token = await getToken()
  const result = await apiFetch(`/access-requests/admin/${id}/message`, token, {
    method: 'POST',
    body: JSON.stringify({ message: cleanMessage, meetingLink: cleanLink }),
  })
  if (!result) return { error: 'Error al enviar el mensaje' }
  return {}
}
