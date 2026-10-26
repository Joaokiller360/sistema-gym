const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1'

/**
 * Short, log-friendly version of an error body. A proxy in front of the API
 * (e.g. a Cloudflare tunnel that is down) answers with a full HTML page;
 * keep only its <title> instead of dumping the whole document.
 */
function describeBody(text: string) {
  const trimmed = text.trim()
  if (trimmed.startsWith('<')) {
    const title = trimmed.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim()
    return `HTML response${title ? ` "${title}"` : ''} — the API is probably unreachable (check ${API_URL})`
  }
  return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed
}

function parseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return null
  }
}

export async function apiFetch<T>(
  path: string,
  token: string,
  options?: RequestInit & { silent?: boolean },
): Promise<T | null> {
  const { silent, ...fetchOptions } = options ?? {}
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...fetchOptions?.headers,
      },
    })

    const text = await res.text()

    if (!res.ok) {
      if (!silent && process.env.NODE_ENV !== 'production') {
        console.error(`[apiFetch] ${fetchOptions?.method ?? 'GET'} ${path} → ${res.status}:`, describeBody(text))
      }
      return null
    }

    if (!text) return null
    return JSON.parse(text) as T
  } catch (e) {
    if (!silent && process.env.NODE_ENV !== 'production') {
      console.error(`[apiFetch] ${path}:`, e)
    }
    return null
  }
}

export async function apiFetchWithError<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<{ data: T } | { error: string }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    })

    const text = await res.text()
    const json = parseJson(text) as { message?: unknown } | null

    if (!res.ok) {
      const msg = json?.message
        ? Array.isArray(json.message) ? json.message.join(', ') : String(json.message)
        : res.status >= 500 && json === null
          ? 'No se pudo conectar con el servidor'
          : `Error ${res.status}`
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[apiFetchWithError] ${options?.method ?? 'GET'} ${path} → ${res.status}:`, json ? JSON.stringify(json) : describeBody(text))
      }
      return { error: msg }
    }
    if (json === null) return { error: 'Respuesta inválida del servidor' }

    return { data: json as T }
  } catch {
    return { error: 'Error de conexión con el servidor' }
  }
}
