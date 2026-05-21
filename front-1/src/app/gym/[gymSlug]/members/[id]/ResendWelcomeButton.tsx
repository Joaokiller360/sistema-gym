'use client'

import { useState, useTransition } from 'react'
import { Mail, Check } from 'lucide-react'
import { resendWelcomeEmailAction } from './actions'

interface Props {
  memberId: string
}

export function ResendWelcomeButton({ memberId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-all disabled:opacity-60 ${
          sent
            ? 'border-[#1fad9d]/30 bg-[#1fad9d]/8 text-[#1fad9d]'
            : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
        }`}
      >
        {sent ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Correo enviado
          </>
        ) : (
          <>
            <Mail className="h-3.5 w-3.5" />
            {isPending ? 'Enviando…' : 'Reenviar correo de bienvenida'}
          </>
        )}
      </button>
      {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}
    </div>
  )
}
