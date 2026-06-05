'use server'

import { apiFetch } from '@/lib/api'
import { sanitize, isValid } from '@/lib/input-validation'

export interface AccessRequestPayload {
  name: string
  email: string
  phone?: string
  country: string
  callingCode?: string
  preferredDate: string
}

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]{1,64}@[a-zA-Z0-9.\-]{1,253}\.[a-zA-Z]{2,}$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const CALLING_CODE_RE = /^\+\d{1,4}$/

const VALID_COUNTRY_CODES = new Set([
  'AR','MX','CO','CL','PE','VE','EC','BO','PY','UY','BR',
  'CR','PA','DO','GT','HN','SV','NI','CU','PR',
  'ES','US','CA','PT','FR','DE','IT','GB','AU','OTHER',
])

export async function submitAccessRequestAction(
  payload: AccessRequestPayload,
): Promise<{ error?: string }> {
  // Reject oversized payloads
  const raw = JSON.stringify(payload)
  if (raw.length > 2_500) return { error: 'Solicitud inválida' }

  // Sanitize
  const name        = sanitize(payload.name  ?? '', 'name')
  const email       = sanitize(payload.email ?? '', 'email').toLowerCase()
  const phone       = payload.phone ? sanitize(payload.phone, 'phone') : undefined
  const country     = (payload.country ?? '').trim().toUpperCase()
  const callingCode = payload.callingCode ? sanitize(payload.callingCode.trim(), 'phone') : undefined
  const preferredDate = (payload.preferredDate ?? '').trim()

  // Name: 2–80 chars
  if (name.length < 2 || name.length > 80) return { error: 'Nombre inválido (2-80 caracteres)' }
  if (!isValid(name, 'name')) return { error: 'Nombre contiene caracteres no permitidos' }

  // Email
  if (!email || !EMAIL_RE.test(email)) return { error: 'Email inválido' }
  if (email.length > 254) return { error: 'Email demasiado largo' }

  // Phone: optional, 6–20 chars
  if (phone !== undefined && (phone.length < 6 || phone.length > 20)) {
    return { error: 'Teléfono inválido (6-20 dígitos)' }
  }

  // Country: must be in whitelist
  if (!country || !VALID_COUNTRY_CODES.has(country)) {
    return { error: 'País inválido' }
  }

  // Calling code: optional, format +N to +NNNN
  if (callingCode !== undefined && callingCode.length > 0) {
    if (!CALLING_CODE_RE.test(callingCode)) return { error: 'Código de llamada inválido (ej. +54)' }
  }

  // Date: ISO format + future + max 1 year
  if (!ISO_DATE_RE.test(preferredDate)) return { error: 'Fecha inválida' }
  const picked = new Date(preferredDate)
  if (isNaN(picked.getTime())) return { error: 'Fecha inválida' }
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  if (picked < tomorrow) return { error: 'La fecha debe ser a partir de mañana' }
  const maxDate = new Date()
  maxDate.setFullYear(maxDate.getFullYear() + 1)
  if (picked > maxDate) return { error: 'Fecha demasiado lejana' }

  const result = await apiFetch('/access-requests', '', {
    method: 'POST',
    body: JSON.stringify({
      name,
      email,
      phone: phone || undefined,
      country,
      callingCode: callingCode || undefined,
      preferredDate: picked.toISOString(),
    }),
  })

  if (!result) return { error: 'Error al enviar la solicitud. Intentá de nuevo.' }
  return {}
}
