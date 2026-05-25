const API_URL = process.env.API_URL ?? 'http://localhost:3001/api/v1'

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
        console.error(`[apiFetch] ${fetchOptions?.method ?? 'GET'} ${path} → ${res.status}:`, text)
      }
      return null
    }

    if (!text) return {} as T
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
    const json = text ? JSON.parse(text) : {}

    if (!res.ok) {
      const msg = json?.message
        ? Array.isArray(json.message) ? json.message.join(', ') : String(json.message)
        : `Error ${res.status}`
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[apiFetchWithError] ${options?.method ?? 'GET'} ${path} → ${res.status}:`, JSON.stringify(json))
      }
      return { error: msg }
    }

    return { data: json as T }
  } catch {
    return { error: 'Error de conexión con el servidor' }
  }
}
