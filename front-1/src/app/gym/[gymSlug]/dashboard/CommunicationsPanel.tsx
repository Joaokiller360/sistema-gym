import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Communication } from '@/types'
import { Mail, ExternalLink } from 'lucide-react'
import Link from 'next/link'

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

interface Props {
  gymSlug: string
}

export async function CommunicationsPanel({ gymSlug }: Props) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const communications = await apiFetch<Communication[]>('/communications', token, {
    silent: true,
    headers: { 'x-gym-slug': gymSlug },
    next: { tags: [`communications-${gymSlug}`] },
  }) ?? []

  const recent = communications.slice(0, 5)

  return (
    <div className="rounded-xl border bg-card p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Mail className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <h2 className="font-semibold">Novedades y comunicaciones</h2>
        </div>
        {communications.length > 0 && (
          <Link
            href={`/gym/${gymSlug}/communications`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todas
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Mail className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Sin comunicaciones por ahora</p>
          <p className="text-xs text-muted-foreground/60">Aquí verás los mensajes del equipo de soporte</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {recent.map(c => (
            <li key={c.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium leading-snug">{c.subject}</span>
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{fmtDate(c.sentAt)}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{c.body}</p>
              <p className="text-[11px] text-muted-foreground/70">
                {c.sentBy?.name?.trim() || 'Equipo de soporte'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
