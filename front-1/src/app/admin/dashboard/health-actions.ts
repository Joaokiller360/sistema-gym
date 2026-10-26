'use server'

import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1'
const TIMEOUT_MS = 8000

export interface ApiHealth {
  /** HTTP status of GET /health, null when the API could not be reached */
  httpStatus: number | null
  latencyMs: number
  db: 'ok' | 'down' | 'unknown'
  dbLatencyMs: number | null
  uptimeSeconds: number | null
  checkedAt: string
  error?: string
}

interface HealthBody {
  db?: { ok?: boolean; latencyMs?: number }
  uptimeSeconds?: number
  // Nest wraps the 503 payload under `message`
  message?: { db?: { ok?: boolean; latencyMs?: number }; uptimeSeconds?: number }
}

export async function checkApiHealthAction(): Promise<ApiHealth | { error: string }> {
  const token = (await cookies()).get('session')?.value
  const session = token ? await verifyToken(token) : null
  if (session?.role !== 'SUPER_ADMIN') return { error: 'No autorizado' }

  const started = performance.now()
  const checkedAt = new Date().toISOString()
  try {
    const res = await fetch(`${API_URL}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const latencyMs = Math.round(performance.now() - started)
    const text = await res.text()
    let body: HealthBody | null = null
    try {
      body = text ? (JSON.parse(text) as HealthBody) : null
    } catch {
      // Non-JSON answer (e.g. a proxy error page)
    }
    const payload = body?.db ? body : body?.message
    const db = payload?.db?.ok === true ? 'ok' : payload?.db?.ok === false ? 'down' : 'unknown'
    return {
      httpStatus: res.status,
      latencyMs,
      db,
      dbLatencyMs: payload?.db?.latencyMs ?? null,
      uptimeSeconds: payload?.uptimeSeconds ?? null,
      checkedAt,
      error: res.ok ? undefined : body ? undefined : 'Respuesta no válida (¿proxy o túnel caído?)',
    }
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError'
    return {
      httpStatus: null,
      latencyMs: Math.round(performance.now() - started),
      db: 'unknown',
      dbLatencyMs: null,
      uptimeSeconds: null,
      checkedAt,
      error: timedOut ? `Sin respuesta en ${TIMEOUT_MS / 1000} s` : 'No se pudo conectar con la API',
    }
  }
}
