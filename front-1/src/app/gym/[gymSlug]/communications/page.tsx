import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Communication } from '@/types'

interface Props {
  params: Promise<{ gymSlug: string }>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function CommunicationsPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const communications = await apiFetch<Communication[]>(`/communications`, token, {
    next: { tags: [`communications-${gymSlug}`] },
  }) ?? []

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comunicaciones</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {communications.length} mensaje{communications.length !== 1 ? 's' : ''} enviado{communications.length !== 1 ? 's' : ''}
        </p>
      </div>

      {communications.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-20">
          <p className="text-muted-foreground text-sm">No hay comunicaciones enviadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {communications.map(c => (
            <div key={c.id} className="rounded-xl border bg-card p-5 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-medium">{c.subject}</h3>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(c.sentAt)}</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{c.body}</p>
              <p className="text-xs text-muted-foreground">
                {c.recipientIds.length} destinatario{c.recipientIds.length !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
