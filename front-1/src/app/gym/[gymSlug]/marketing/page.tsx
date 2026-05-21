import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { EmailCampaign, CampaignStatus } from '@/types'

interface Props {
  params: Promise<{ gymSlug: string }>
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  SENT: 'Enviada',
  CANCELLED: 'Cancelada',
}

const STATUS_COLORS: Record<CampaignStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function MarketingPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const campaigns = await apiFetch<EmailCampaign[]>(`/marketing/campaigns`, token, {
    next: { tags: [`marketing-${gymSlug}`] },
  }) ?? []

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {campaigns.length} campaña{campaigns.length !== 1 ? 's' : ''}
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-20">
          <p className="text-muted-foreground text-sm">No hay campañas creadas</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campaña</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Programada</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Enviada</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Métricas</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map(c => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(c.scheduledAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(c.sentAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {c.metrics.sent != null ? `${c.metrics.sent} enviados` : '—'}
                    {c.metrics.opened != null ? ` · ${c.metrics.opened} abiertos` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
