'use client'

import { useState, useTransition } from 'react'
import { Mail, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btn, field } from '@/components/admin/ui'
import { resendGymWelcomeEmailAction } from '../actions'

export function ResendGymWelcomeButton({ gymId }: { gymId: string }) {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    if (isPending || sent) return
    setError(null)
    startTransition(async () => {
      const res = await resendGymWelcomeEmailAction(gymId)
      if (res.error) {
        setError(res.error)
      } else {
        setSent(true)
        setTimeout(() => setSent(false), 4000)
      }
    })
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || sent}
        aria-live="polite"
        className={cn(btn.line, 'min-h-11 text-sm', sent && 'border-adm-ok-line bg-adm-ok-bg text-adm-ok-fg disabled:opacity-100')}
      >
        {sent ? <Check className="size-4" aria-hidden="true" /> : <Mail className="size-4" aria-hidden="true" />}
        {sent ? 'Correo enviado' : isPending ? 'Enviando…' : 'Reenviar bienvenida'}
      </button>
      {error && <p className={field.error}>{error}</p>}
    </div>
  )
}
