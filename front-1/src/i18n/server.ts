import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale, LOCALE_COOKIE, type Locale, type Messages } from './config'

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** Messages for the current user's language, for server components and server actions. */
export async function getT<T>(messages: Messages<T>): Promise<T> {
  return messages[await getLocale()]
}

export async function getIntlLocale(): Promise<string> {
  return INTL_LOCALE[await getLocale()]
}

/** Only callable from server actions / route handlers (cookies are read-only in components). */
export async function setLocaleCookie(locale: Locale) {
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}
