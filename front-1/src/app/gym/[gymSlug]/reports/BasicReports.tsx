'use client'

import { useRouter } from 'next/navigation'
import { useIntlLocale, useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'
import { reportsMessages } from './messages'

interface FinancialReport {
  totalRevenue: number
  currency: string
  byMethod: { method: string; total: number; count: number }[]
}

interface RetentionReport {
  activeCount: number
  expiredCount: number
  retentionRate: number
}

interface AttendanceReport {
  totalCheckins: number
  avgPerDay: number
  peakHour: string | null
}

interface Props {
  defaultMonth: string
  financial: FinancialReport | null
  retention: RetentionReport | null
  attendance: AttendanceReport | null
}

export function BasicReports({ defaultMonth, financial, retention, attendance }: Props) {
  const router = useRouter()
  const t = useT(reportsMessages).basic
  const tc = useT(commonMessages)
  const intl = useIntlLocale()
  const targetMonth = defaultMonth ? new Date(defaultMonth + '-01') : new Date()
  const monthStr = targetMonth.toLocaleDateString(intl, { month: 'long', year: 'numeric' })
  const currency = financial?.currency ?? 'ARS'
  const revenue = (financial?.totalRevenue ?? 0) / 100

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground text-sm mt-1 capitalize">{monthStr}</p>
        </div>
        <input
          type="month"
          defaultValue={defaultMonth}
          onChange={e => { if (e.target.value) router.push(`?month=${e.target.value}`) }}
          className="rounded-md border px-3 py-1.5 text-sm bg-background"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t.monthRevenue}</p>
          <p className="text-3xl font-bold mt-1">{currency} {revenue.toLocaleString(intl)}</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t.activeMemberships}</p>
          <p className="text-3xl font-bold mt-1">{retention?.activeCount ?? '—'}</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t.retention}</p>
          <p className="text-3xl font-bold mt-1">
            {retention ? `${parseFloat(String(retention.retentionRate)).toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t.checkins}</p>
          <p className="text-3xl font-bold mt-1">{attendance?.totalCheckins ?? '—'}</p>
        </div>
      </div>

      {(financial?.byMethod.length ?? 0) > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b">
            {t.byMethod}
          </p>
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colMethod}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colPayments}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colTotal}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {financial!.byMethod.map(b => (
                <tr key={b.method} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{tc.methods[b.method] ?? b.method}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.count}</td>
                  <td className="px-4 py-3">{currency} {(b.total ?? 0).toLocaleString(intl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
