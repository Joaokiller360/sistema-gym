import { jwtVerify } from 'jose'
import { SessionPayload } from '@/types'

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET env var is required in production')
}
const SECRET = new TextEncoder().encode(jwtSecret ?? 'dev-only-insecure-secret')

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
