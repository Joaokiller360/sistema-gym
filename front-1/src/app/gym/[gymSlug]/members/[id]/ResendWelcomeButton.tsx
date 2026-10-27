'use client'

import { useState, useTransition } from 'react'
import { Mail, Check } from 'lucide-react'
import { resendWelcomeEmailAction } from './actions'
import { useT } from '@/i18n/client'
import { membersMessages } from '../messages'

interface Props {
  memberId: string
}

export function ResendWelcomeButton({ memberId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = useT(membersMessages).welcome

  function handleClick() {
    if (isPending || sent) return
    setError(null)
    startTransition(async () => {
      const res = await resendWelcomeEmailAction(memberId)
      if (res.error) {
        setError(res.error)
      } else {
        setSent(true)
        setTimeout(() => setSent(false), 4000)
      }
    })
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || sent}
        className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-[13px] font-bold transition-colors disabled:opacity-60 ${
          sent
            ? 'border-adm-ok-line bg-adm-ok-bg text-adm-ok-fg'
            : 'border-adm-line bg-adm-surface text-adm-ink hover:bg-adm-chip'
        }`}
      >
        {sent ? (
          <>
            <Check className="h-3.5 w-3.5" />
            {t.sent}
          </>
        ) : (
          <>
            <Mail className="h-3.5 w-3.5" />
            {isPending ? t.sending : t.resend}
          </>
        )}
      </button>
      {error && <p className="text-xs font-medium text-adm-bad-fg">{error}</p>}
    </div>
  )
}
