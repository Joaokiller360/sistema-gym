'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { apiFetchWithError } from '@/lib/api'
import { isLocale } from './config'
import { setLocaleCookie } from './server'

/** Saves the language on the user's account, so it follows them to other devices. */
export async function setLanguageAction(locale: string): Promise<{ error?: string }> {
  if (!isLocale(locale)) return { error: 'Unsupported language' }
  const token = (await cookies()).get('session')?.value ?? ''

  const res = await apiFetchWithError('/auth/me', token, {
    method: 'PATCH',
    body: JSON.stringify({ language: locale }),
  })
  if ('error' in res) return { error: res.error }

  await setLocaleCookie(locale)
  revalidatePath('/', 'layout')
  return {}
}

/** Re-reads the account language from the API and mirrors it into the cookie (e.g. changed on another device). */
export async function syncLocaleAction(): Promise<void> {
  const token = (await cookies()).get('session')?.value ?? ''
  const res = await apiFetchWithError<{ language?: string }>('/auth/me', token)
  if ('error' in res || !isLocale(res.data.language)) return
  await setLocaleCookie(res.data.language)
  revalidatePath('/', 'layout')
}
