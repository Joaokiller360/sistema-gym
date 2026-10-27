import { BarChart2 } from 'lucide-react'
import { EmptyState, Meter, Panel, PanelLink, SectionLabel, Stat } from '@/components/admin/ui'
import { getIntlLocale, getT } from '@/i18n/server'
import { dashboardMessages } from './messages'

export interface AdvancedReport {
  revenueTrend: { label: string; amount: number }[]
  storeSalesTrend: { label: string; amount: number }[]
  storeCreditTrend: { label: string; amount: number }[]
  storeRevenue: number
  storeCreditIssued: number
  membersByPlan: { planName: string; count: number; price: number; percent: number }[]
  attendanceTrend: { label: string; count: number }[]
  attendanceTrendByGroup: { groupId: string | null; groupName: string | null; trend: { label: string; count: number }[] }[]
  newMembers: number
  churned: number
  expiringNext7Days: number
  peakDay: string | null
  peakHour: string | null
  currency: string
}

interface Props {
  gymSlug: string
  data: AdvancedReport | null
}

function fmt(n: number, currency: string, intl: string) {
  return `${currency} ${n.toLocaleString(intl)}`
}

/** Bar chart on the dark night surface; the last bar is highlighted in brand yellow. */
function NightBars({ data, title }: { data: { label: string; value: number; tooltip: string }[]; title: string }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <>
      <div className="mt-6 flex h-[140px] items-end gap-1.5 border-b border-[#2a2a2c]" role="img" aria-label={title}>
        {data.map((d, i) => {
          const last = i === data.length - 1
          return (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={d.tooltip}>
              <div
                className={last ? 'w-full max-w-7 rounded-t bg-adm-brand' : 'w-full max-w-7 rounded-t bg-[#3a3a3d]'}
                style={{ height: `${d.value > 0 ? Math.max(4, (d.value / max) * 88) : 2}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {data.map((d, i) => (
          <div key={i} className="min-w-0 flex-1 truncate text-center font-admin-mono text-[10px] text-[#85857f]">{d.label}</div>
        ))}
      </div>
    </>
  )
}

export async function AdvancedReportsSection({ gymSlug, data }: Props) {
  const [messages, intl] = await Promise.all([getT(dashboardMessages), getIntlLocale()])
  const t = messages.adv
  if (!data) {
    return (
      <Panel title={t.title} id="adv-h">
        <EmptyState icon={<BarChart2 className="size-8" aria-hidden="true" />}>
          {t.empty}
        </EmptyState>
      </Panel>
    )
  }

  const revenueTotal = data.revenueTrend.reduce((s, d) => s + d.amount, 0)

  return (
    <section aria-labelledby="adv-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionLabel id="adv-h">{t.heading}</SectionLabel>
        <PanelLink href={`/gym/${gymSlug}/reports`}>{t.fullReports}</PanelLink>
      </div>

      <div className="flex flex-wrap gap-3">
        <Stat label={t.newThisMonth} value={data.newMembers} />
        <Stat label={t.churnThisMonth} value={data.churned} hint={data.churned > 0 ? t.checkRetention : undefined} hintTone="bad" />
        <Stat label={t.expiring7} value={data.expiringNext7Days} hint={data.expiringNext7Days > 0 ? t.contactToRenew : undefined} hintTone="warn" />
        <Stat label={t.peakHour} value={data.peakHour ?? '—'} hint={data.peakDay ?? undefined} />
      </div>

      <div className="flex flex-wrap gap-3">
        {data.revenueTrend.length > 0 && (
          <section aria-labelledby="adv-rev-h" className="min-w-0 flex-[2_1_480px] rounded-2xl border border-adm-line bg-adm-night p-6 text-white">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 id="adv-rev-h" className="text-[15px] font-bold">{t.revenueTrend}</h3>
                <p className="mt-1 text-[13px] text-[#a3a39d]">{data.currency}</p>
              </div>
              <span className="font-admin-mono text-[13px] font-bold text-adm-brand">{fmt(revenueTotal, data.currency, intl)}</span>
            </div>
            <NightBars
              title={t.revenueTrendAria(fmt(revenueTotal, data.currency, intl))}
              data={data.revenueTrend.map(d => ({ label: d.label, value: d.amount, tooltip: `${d.label}: ${fmt(d.amount, data.currency, intl)}` }))}
            />
          </section>
        )}

        {data.membersByPlan.length > 0 && (
          <Panel title={t.byPlan} id="adv-plan-h" className="min-w-0 flex-[1_1_280px]" bodyClassName="flex flex-col gap-4 p-5">
            {data.membersByPlan.map(p => (
              <div key={p.planName} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-[13px]">
                  <span className="truncate font-semibold">{p.planName}</span>
                  <span className="shrink-0 font-admin-mono">{p.count} · {p.percent}%</span>
                </div>
                <Meter value={p.percent} className="h-2.5" />
              </div>
            ))}
          </Panel>
        )}
      </div>

      {data.attendanceTrend.length > 0 && (
        <section aria-labelledby="adv-att-h" className="rounded-2xl border border-adm-line bg-adm-night p-6 text-white">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="adv-att-h" className="text-[15px] font-bold">{t.attendance7}</h3>
              <p className="mt-1 text-[13px] text-[#a3a39d]">{t.perDay}</p>
            </div>
            <span className="font-admin-mono text-[13px] text-[#a3a39d]">
              {messages.entries(data.attendanceTrend.reduce((s, d) => s + d.count, 0))}
            </span>
          </div>
          <NightBars
            title={t.attendance7Aria}
            data={data.attendanceTrend.map(d => ({ label: d.label, value: d.count, tooltip: `${d.label}: ${d.count}` }))}
          />
        </section>
      )}
    </section>
  )
}
