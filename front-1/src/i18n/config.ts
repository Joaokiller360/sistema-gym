export const LOCALES = ['es', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'es'

/** Mirrors the user's saved `language`; set at login and when they switch. */
export const LOCALE_COOKIE = 'locale'

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale)

/** BCP 47 tag for Intl formatting (dates, numbers, currency). */
export const INTL_LOCALE: Record<Locale, string> = { es: 'es-AR', en: 'en-US' }

export type Messages<T> = Record<Locale, T>

/** Spanish is the source of truth; English must match its shape exactly. */
export function defineMessages<T>(messages: { es: T; en: NoInfer<T> }): Messages<T> {
  return messages
}
