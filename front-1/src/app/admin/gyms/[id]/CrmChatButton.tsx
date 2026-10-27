'use client'

import { useState, useTransition } from 'react'
import { Loader2, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btn, field } from '@/components/admin/ui'
import { startConversationAction } from '@/app/admin/crm/actions'

/** Opens this gym's WhatsApp thread in the CRM (creates it if needed). */
export function CrmChatButton({ gymId, hasWhatsapp }: { gymId: string; hasWhatsapp: boolean }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div>
      <button
        type="button"
        disabled={!hasWhatsapp || isPending}
        onClick={() => startTransition(async () => { const res = await startConversationAction(gymId); setError(res.error) })}
        className={cn(btn.line, 'w-full min-h-11')}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <MessageCircle className="size-4" aria-hidden="true" />}
        Conversar por WhatsApp
      </button>
      <p className={error ? field.error : field.hint}>
        {error ?? (hasWhatsapp ? 'Abre la conversación en el CRM.' : 'Cargá el WhatsApp del dueño en “Editar” para poder escribirle.')}
      </p>
    </div>
  )
}
