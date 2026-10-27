import Link from 'next/link'
import { cookies } from 'next/headers'
import { Package, Tag } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { Gym, InventoryItem, InventoryStatus } from '@/types'
import { getT } from '@/i18n/server'
import { inventoryMessages } from './messages'
import { CategoriesTab, ProductsTab, type Category, type CutSummary, type Product } from '../store/StoreTabs'

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ tab?: string }>
}

type Tab = 'equipment' | 'products' | 'categories'

const STATUS_COLORS: Record<InventoryStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  OUT_OF_SERVICE: 'bg-red-100 text-red-700',
  MAINTENANCE: 'bg-amber-100 text-amber-700',
  RETIRED: 'bg-muted text-muted-foreground',
}

export default async function InventoryPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { tab: rawTab } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const headers = { 'x-gym-slug': gymSlug }
  const t = await getT(inventoryMessages)

  const gym = await apiFetch<Gym>(`/gyms/${gymSlug}`, token, { next: { tags: [`gym-${gymSlug}`] } })
  // Products and categories belong to the store; without it only the equipment list is left
  const storeEnabled = gym?.storeEnabled ?? false
  const tab: Tab = !storeEnabled ? 'equipment' : rawTab === 'categories' ? 'categories' : 'products'

  const tabs: { key: Tab; icon: typeof Package }[] = storeEnabled
    ? [{ key: 'products', icon: Package }, { key: 'categories', icon: Tag }]
    : []

  return (
    <div className="space-y-6 p-4 font-admin sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-admin-mono text-xs uppercase tracking-[0.08em] text-zinc-500">{t.title}</p>
          <h1 className="text-4xl font-black leading-none tracking-tight">{t.tabs[tab]}</h1>
        </div>
        {tabs.length > 1 && (
          <nav aria-label={t.sections} className="flex flex-wrap gap-1 rounded-2xl border border-zinc-200 bg-white p-1">
            {tabs.map(({ key, icon: Icon }) => {
              const active = key === tab
              return (
                <Link
                  key={key}
                  href={key === 'products' ? '?' : `?tab=${key}`}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm transition-colors ${
                    active ? 'bg-black font-bold text-white hover:bg-zinc-800' : 'font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t.tabs[key]}
                </Link>
              )
            })}
          </nav>
        )}
      </header>

      {tab === 'equipment' && <EquipmentTab gymSlug={gymSlug} token={token} t={t} />}
      {tab !== 'equipment' && <StoreCatalog gymSlug={gymSlug} token={token} headers={headers} tab={tab} />}
    </div>
  )
}

async function EquipmentTab({ gymSlug, token, t }: { gymSlug: string; token: string; t: (typeof inventoryMessages)['es'] }) {
  const items = await apiFetch<InventoryItem[]>(`/inventory`, token, {
    next: { tags: [`inventory-${gymSlug}`] },
  }) ?? []

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.count(items.length)}</p>
      {items.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-20">
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.colName}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.colQuantity}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.colSerial}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.quantity}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {item.serialNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                      {t.status[item.status]}
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

async function StoreCatalog({ gymSlug, token, headers, tab }: {
  gymSlug: string
  token: string
  headers: Record<string, string>
  tab: 'products' | 'categories'
}) {
  const session = await verifyToken(token)
  const canDelete = session?.role === 'SUPER_ADMIN'
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [products, categories, monthlyCut] = await Promise.all([
    apiFetch<Product[]>('/store/products', token, { next: { tags: [`store-products-${gymSlug}`] }, headers }).then(r => r ?? []),
    apiFetch<Category[]>('/store/categories', token, { next: { tags: [`store-categories-${gymSlug}`] }, headers }).then(r => r ?? []),
    // Category cards show this month's sales
    tab === 'categories'
      ? apiFetch<CutSummary>(`/store/cuts/monthly?month=${month}`, token, { headers })
      : Promise.resolve(null),
  ])

  return tab === 'products'
    ? <ProductsTab gymSlug={gymSlug} products={products} categories={categories} canDelete={canDelete} />
    : <CategoriesTab gymSlug={gymSlug} categories={categories} products={products} monthlyCut={monthlyCut} monthParam={month} canDelete={canDelete} />
}
