'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, ExternalLink, Mail, RefreshCw, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btn } from '@/components/admin/ui'
import { issueWalletPassAction, emailWalletPassAction, revokeWalletPassAction, type WalletPassInfo } from './wallet-actions'

export function WalletPassCard({
  gymSlug,
  memberId,
  memberEmail,
  pass,
  canRevoke,
}: {
  gymSlug: string
  memberId: string
  memberEmail: string
  pass: WalletPassInfo | null
  canRevoke: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [sendEmail, setSendEmail] = useState(true)

  // No data means this role can't manage passes (or the API is down): show nothing.
  if (!pass) return null

  if (!pass.configured) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pase de Wallet</p>
        <p className="max-w-xs text-xs text-zinc-500">No disponible: falta configurar WalletWallet en el servidor.</p>
      </div>
    )
  }

  function issue(regenerate: boolean) {
    if (regenerate && !window.confirm('Se genera un pase nuevo y el QR anterior deja de funcionar. ¿Continuar?')) return
    startTransition(async () => {
      const res = await issueWalletPassAction(gymSlug, memberId, sendEmail)
      if (res.error) { toast.error(res.error); return }
      toast.success(res.emailSent ? `Pase creado y enviado a ${memberEmail}` : 'Pase creado')
      router.refresh()
    })
  }

  function email() {
    startTransition(async () => {
      const res = await emailWalletPassAction(gymSlug, memberId)
      if (res.error || !res.emailSent) { toast.error(res.error ?? 'No se pudo enviar el correo'); return }
      toast.success(`Enviado a ${memberEmail}`)
    })
  }

  function revoke() {
    if (!window.confirm('El pase se elimina del Wallet del socio y su QR deja de funcionar. ¿Continuar?')) return
    startTransition(async () => {
      const res = await revokeWalletPassAction(gymSlug, memberId)
      if (res.error) { toast.error(res.error); return }
      toast.success('Pase revocado')
      router.refresh()
    })
  }

  async function copy() {
    if (!pass?.shareUrl) return
    try {
      await navigator.clipboard.writeText(pass.shareUrl)
      toast.success('Link copiado')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <div className="admin-surface space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <Wallet className="size-3.5" aria-hidden="true" /> Pase de Wallet
      </p>
      {pass.issued && pass.shareUrl ? (
        <>
          <p className="text-xs text-zinc-500">
            Activo desde {pass.issuedAt ? new Date(pass.issuedAt).toLocaleDateString('es-AR') : '—'}. El QR sirve para asistencia, compras y fiado.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <a href={pass.shareUrl} target="_blank" rel="noopener noreferrer" className={btn.line}>
              <ExternalLink className="size-3.5" aria-hidden="true" /> Abrir
            </a>
            <button type="button" onClick={copy} className={btn.line}>
              <Copy className="size-3.5" aria-hidden="true" /> Copiar link
            </button>
            <button type="button" onClick={email} disabled={isPending} className={btn.line}>
              <Mail className="size-3.5" aria-hidden="true" /> Enviar por email
            </button>
            <button type="button" onClick={() => issue(true)} disabled={isPending} className={btn.line}>
              <RefreshCw className="size-3.5" aria-hidden="true" /> Regenerar
            </button>
            {canRevoke && (
              <button type="button" onClick={revoke} disabled={isPending} className={cn(btn.line, 'text-adm-bad-fg hover:border-adm-bad-line')}>
                Revocar
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="size-4 accent-adm-ink" />
            Enviarlo a {memberEmail}
          </label>
          <button type="button" onClick={() => issue(false)} disabled={isPending} className={btn.dark}>
            <Wallet className="size-3.5" aria-hidden="true" />
            {isPending ? 'Generando…' : 'Generar pase con QR'}
          </button>
        </>
      )}
    </div>
  )
}
