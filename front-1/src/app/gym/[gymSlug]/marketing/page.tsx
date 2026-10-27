import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { EmailCampaign, CampaignStatus } from '@/types'
import { getIntlLocale, getT } from '@/i18n/server'
import { marketingMessages } from './messages'

interface Props {
  params: Promise<{ gymSlug: string }>
}

const STATUS_COLORS: Record<CampaignStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENT: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

function formatDate(iso: string | null, intl: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(intl, { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function MarketingPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const [t, intl] = await Promise.all([getT(marketingMessages), getIntlLocale()])

  const campaigns = await apiFetch<EmailCampaign[]>(`/marketing/campaigns`, token, {
    next: { tags: [`marketing-${gymSlug}`] },
  }) ?? []

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t.count(campaigns.length)}
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-20">
          <p className="text-muted-foreground text-sm">{t.empty}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colCampaign}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colStatus}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colScheduled}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colSent}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colMetrics}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map(c => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                      {t.status[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(c.scheduledAt, intl)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(c.sentAt, intl)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {c.metrics.sent != null ? t.sent(c.metrics.sent) : '—'}
                    {c.metrics.opened != null ? t.opened(c.metrics.opened) : ''}
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
