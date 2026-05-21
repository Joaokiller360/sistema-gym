import { jwtVerify } from 'jose'
import { SessionPayload } from '@/types'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'change-me')

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
