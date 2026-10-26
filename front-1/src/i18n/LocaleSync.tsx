'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { syncLocaleAction } from './actions'

/** Rendered only when the account language and the cookie disagree; fixes the cookie once. */
export function LocaleSync() {
  const router = useRouter()
  useEffect(() => {
    syncLocaleAction().then(() => router.refresh()).catch(() => {})
  }, [router])
  return null
}
