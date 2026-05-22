'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  gymSlug: string
  financial: FinancialReport | null
  retention: RetentionReport | null
  attendance: AttendanceReport | null
  defaultMonth: string
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
}

const TABS = ['Financiero', 'Retención', 'Asistencia'] as const
type Tab = typeof TABS[number]

export function ReportsTabs({ gymSlug, financial, retention, attendance, defaultMonth }: Props) {
  const [active, setActive] = useState<Tab>('Financiero')
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 border rounded-lg p-1 bg-muted/30">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                active === tab
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <input
          type="month"
          defaultValue={defaultMonth}
          onChange={e => {
            if (e.target.value) router.push(`?month=${e.target.value}`)
          }}
          className="rounded-md border px-3 py-1.5 text-sm bg-background"
        />
      </div>

      {active === 'Financiero' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-6">
              <p className="text-sm text-muted-foreground">Ingresos totales</p>
              <p className="text-3xl font-bold mt-1">
                {financial?.currency ?? 'ARS'}{' '}
                {((financial?.totalRevenue ?? 0) / 100).toLocaleString('es-AR')}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <p className="text-sm text-muted-foreground">Pagos procesados</p>
              <p className="text-3xl font-bold mt-1">
                {financial?.byMethod.reduce((s, b) => s + b.count, 0) ?? 0}
              </p>
            </div>
          </div>

          {(financial?.byMethod.length ?? 0) > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Método</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pagos</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {financial!.byMethod.map(b => (
                    <tr key={b.method} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{METHOD_LABELS[b.method] ?? b.method}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.count}</td>
                      <td className="px-4 py-3">{financial!.currency} {((b.total ?? 0) / 100).toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {active === 'Retención' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Membresías activas</p>
            <p className="text-3xl font-bold mt-1">{retention?.activeCount ?? '—'}</p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Membresías vencidas</p>
            <p className="text-3xl font-bold mt-1">{retention?.expiredCount ?? '—'}</p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Tasa de retención</p>
            <p className="text-3xl font-bold mt-1">
              {retention ? `${parseFloat(String(retention.retentionRate)).toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>
      )}

      {active === 'Asistencia' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Total check-ins</p>
            <p className="text-3xl font-bold mt-1">{attendance?.totalCheckins ?? '—'}</p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Promedio por día</p>
            <p className="text-3xl font-bold mt-1">
              {attendance?.avgPerDay != null ? Number(attendance.avgPerDay).toFixed(1) : '—'}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">Hora pico</p>
            <p className="text-3xl font-bold mt-1">{attendance?.peakHour ?? '—'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
