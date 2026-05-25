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

interface StoreCutSummary {
  salesCount: number
  total: number
  byMethod: { method: string; count: number; total: number }[]
  byProduct: { name: string; quantity: number; total: number }[]
}

interface PendingCredit {
  id: string
  memberId: string
  member: { firstName: string; lastName: string }
  productId: string
  quantity: number
  unitPrice: number
  notes: string | null
  createdAt: string
  product: { name: string }
}

interface Props {
  gymSlug: string
  financial: FinancialReport | null
  retention: RetentionReport | null
  attendance: AttendanceReport | null
  storeSales: StoreCutSummary | null
  storeEnabled: boolean
  defaultMonth: string
  pendingCredits: PendingCredit[]
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
}

const TABS_BASE = ['Financiero', 'Retención', 'Asistencia'] as const
type Tab = typeof TABS_BASE[number] | 'Fiados'

export function ReportsTabs({ gymSlug, financial, retention, attendance, storeSales, storeEnabled, defaultMonth, pendingCredits }: Props) {
  const [active, setActive] = useState<Tab>('Financiero')

  const TABS: readonly Tab[] = storeEnabled ? [...TABS_BASE, 'Fiados'] : TABS_BASE
  const router = useRouter()

  const membershipRevenue = (financial?.totalRevenue ?? 0) / 100
  const storeRevenue = storeEnabled ? (storeSales?.total ?? 0) : 0
  const combinedRevenue = membershipRevenue + storeRevenue
  const currency = financial?.currency ?? 'ARS'

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
          <div className={`grid grid-cols-1 gap-4 ${storeEnabled ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <div className="rounded-xl border bg-card p-6">
              <p className="text-sm text-muted-foreground">Membresías</p>
              <p className="text-3xl font-bold mt-1">
                {currency} {membershipRevenue.toLocaleString('es-AR')}
              </p>
            </div>
            {storeEnabled && (
              <div className="rounded-xl border bg-card p-6">
                <p className="text-sm text-muted-foreground">Tienda</p>
                <p className="text-3xl font-bold mt-1">
                  {currency} {storeRevenue.toLocaleString('es-AR')}
                  {(storeSales?.salesCount ?? 0) > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({storeSales!.salesCount} venta{storeSales!.salesCount !== 1 ? 's' : ''})
                    </span>
                  )}
                </p>
              </div>
            )}
            <div className="rounded-xl border bg-card p-6 border-foreground/20">
              <p className="text-sm text-muted-foreground">{storeEnabled ? 'Total combinado' : 'Total'}</p>
              <p className="text-3xl font-bold mt-1">
                {currency} {combinedRevenue.toLocaleString('es-AR')}
              </p>
            </div>
          </div>

          {(financial?.byMethod.length ?? 0) > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b">
                Pagos de membresías por método
              </p>
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
                      <td className="px-4 py-3">{currency} {(b.total ?? 0).toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {storeEnabled && (storeSales?.byMethod.length ?? 0) > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b">
                Ventas de tienda por método
              </p>
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Método</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ventas</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {storeSales!.byMethod.map(b => (
                    <tr key={b.method} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{METHOD_LABELS[b.method] ?? b.method}</td>
                      <td className="px-4 py-3 text-muted-foreground">{b.count}</td>
                      <td className="px-4 py-3">{currency} {(b.total ?? 0).toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {storeEnabled && (storeSales?.byProduct.length ?? 0) > 0 && (
            <div className="rounded-xl border overflow-hidden">
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b">
                Productos más vendidos
              </p>
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Producto</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unidades</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {storeSales!.byProduct.map((p, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.quantity}</td>
                      <td className="px-4 py-3">{currency} {(p.total ?? 0).toLocaleString('es-AR')}</td>
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

      {active === 'Fiados' && (() => {
        const byMember = pendingCredits.reduce<Record<string, { name: string; count: number; total: number }>>((acc, c) => {
          const key = c.memberId
          const name = `${c.member.firstName} ${c.member.lastName}`
          acc[key] = acc[key] ?? { name, count: 0, total: 0 }
          acc[key].count++
          acc[key].total += c.unitPrice * c.quantity
          return acc
        }, {})
        const memberList = Object.values(byMember).sort((a, b) => b.total - a.total)
        const grandTotal = memberList.reduce((s, m) => s + m.total, 0)

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border bg-card p-6">
                <p className="text-sm text-muted-foreground">Total adeudado</p>
                <p className="text-3xl font-bold mt-1">${grandTotal.toLocaleString('es-AR')}</p>
              </div>
              <div className="rounded-xl border bg-card p-6">
                <p className="text-sm text-muted-foreground">Miembros con deuda</p>
                <p className="text-3xl font-bold mt-1">{memberList.length}</p>
              </div>
              <div className="rounded-xl border bg-card p-6">
                <p className="text-sm text-muted-foreground">Ítems pendientes</p>
                <p className="text-3xl font-bold mt-1">{pendingCredits.length}</p>
              </div>
            </div>

            {memberList.length === 0 ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed py-12 text-sm text-muted-foreground">
                No hay créditos pendientes
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <p className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b">
                  Deuda por miembro
                </p>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Miembro</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ítems</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Deuda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {memberList.map((m, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{m.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{m.count}</td>
                        <td className="px-4 py-3 font-bold text-right text-amber-600">${m.total.toLocaleString('es-AR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
