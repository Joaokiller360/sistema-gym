import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { InventoryItem, InventoryStatus } from '@/types'

interface Props {
  params: Promise<{ gymSlug: string }>
}

const STATUS_LABELS: Record<InventoryStatus, string> = {
  ACTIVE: 'Activo',
  OUT_OF_SERVICE: 'Fuera de servicio',
  MAINTENANCE: 'En mantenimiento',
  RETIRED: 'Retirado',
}

const STATUS_COLORS: Record<InventoryStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  OUT_OF_SERVICE: 'bg-red-100 text-red-700',
  MAINTENANCE: 'bg-amber-100 text-amber-700',
  RETIRED: 'bg-muted text-muted-foreground',
}

export default async function InventoryPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const items = await apiFetch<InventoryItem[]>(`/inventory`, token, {
    next: { tags: [`inventory-${gymSlug}`] },
  }) ?? []

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {items.length} ítem{items.length !== 1 ? 's' : ''}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-20">
          <p className="text-muted-foreground text-sm">Proximamente el inventario</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cantidad</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">N° Serie</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.quantity}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {item.serialNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
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
