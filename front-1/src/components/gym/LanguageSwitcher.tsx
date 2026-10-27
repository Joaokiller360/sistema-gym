'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { setLanguageAction } from '@/i18n/actions'
import { useLocale, useT } from '@/i18n/client'
import { LOCALES, type Locale } from '@/i18n/config'
import { shellMessages } from './messages'

/** Per-user panel language, saved on the account. */
export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useT(shellMessages)
  const [isPending, startTransition] = useTransition()

  function choose(next: Locale) {
    if (next === locale) return
    startTransition(async () => {
      const res = await setLanguageAction(next)
      if (res.error) { toast.error(res.error); return }
      toast.success(shellMessages[next].languageSaved)
    })
  }

  return (
    <section aria-labelledby="language-h" className="flex flex-col gap-4 rounded-[20px] border border-adm-line bg-adm-surface p-[22px]">
      <div className="flex flex-col gap-1">
        <h2 id="language-h" className="text-[17px] font-extrabold">{t.language}</h2>
        <p className="text-[13px] text-adm-muted">{t.languageHint}</p>
      </div>
      <div role="radiogroup" aria-labelledby="language-h" className="grid grid-cols-2 gap-1 rounded-[14px] border border-adm-line bg-adm-ground p-1">
        {LOCALES.map(l => {
          const on = l === locale
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={on}
              lang={l}
              disabled={isPending}
              onClick={() => choose(l)}
              className={`h-11 rounded-[10px] text-sm transition-colors disabled:opacity-60 ${
                on ? 'bg-adm-ink font-extrabold text-adm-ground' : 'font-bold text-adm-muted hover:text-adm-ink'
              }`}
            >
              {t.languageNames[l]}
            </button>
          )
        })}
      </div>
    </section>
  )
}
