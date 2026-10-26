'use client'

import { createContext, useContext } from 'react'
import { DEFAULT_LOCALE, INTL_LOCALE, type Locale, type Messages } from './config'

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

export function useIntlLocale(): string {
  return INTL_LOCALE[useLocale()]
}

/** Messages for the current user's language, for client components. */
export function useT<T>(messages: Messages<T>): T {
  return messages[useLocale()]
}
