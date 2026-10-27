'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Package, BarChart2, Calendar, Plus, Minus, Trash2, Edit2, Tag, CreditCard, Search, ChevronLeft, ChevronRight, Printer, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { createSaleAction, createProductAction, updateProductAction, deleteProductAction, deleteSaleAction, createCategoryAction, updateCategoryAction, deleteCategoryAction, assignCreditsAction, payCreditsAction } from './actions'
import { createHandlers, type FieldType, inferFieldType } from '@/lib/input-validation'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useIntlLocale, useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'
import { storeMessages } from './messages'

interface Category {
  id: string
  name: string
  imageUrl: string | null
}

interface Member {
  id: string
  firstName: string
  lastName: string
  email: string
}


interface Product {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  cost: number | null
  stock: number
  categoryId: string | null
  category: Category | null
  isActive: boolean
  _count: { saleItems: number }
}

interface SaleItem {
  productId: string
  quantity: number
  unitPrice: number
  product: { name: string }
}

interface Sale {
  id: string
  total: number
  method: string
  notes: string | null
  createdAt: string
  items: SaleItem[]
}

interface CreditPeriodItem {
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

interface CutSummary {
  salesCount: number
  total: number
  byMethod: { method: string; count: number; total: number }[]
  byProduct: { name: string; quantity: number; total: number }[]
  sales: Sale[]
  credits: {
    count: number
    total: number
    byMember: { memberName: string; count: number; total: number }[]
    items: CreditPeriodItem[]
  }
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
  gymName: string
  products: Product[]
  categories: Category[]
  dailyCut: CutSummary | null
  monthlyCut: CutSummary | null
  activeTab: string
  dateParam: string
  monthParam: string
  members: Member[]
  pendingCredits: PendingCredit[]
  canDelete?: boolean
  canDeleteSales?: boolean
}

const METHODS = ['CASH', 'CARD', 'TRANSFER', 'OTHER']

// Fixed per method so a method keeps its color across days and months
const METHOD_COLORS: Record<string, string> = {
  CASH: 'var(--accent)', CARD: '#5EEAD4', TRANSFER: '#FFFFFF', OTHER: '#A7C9C4',
}

// Labels live in storeMessages.tabs
const TABS = [
  { id: 'sell', icon: ShoppingCart },
  { id: 'credits', icon: CreditCard },
  { id: 'products', icon: Package },
  { id: 'categories', icon: Tag },
  { id: 'daily', icon: Calendar },
  { id: 'monthly', icon: BarChart2 },
] as const

type TabId = (typeof TABS)[number]['id']

type CartItem = { product: Product; quantity: number }

const LOW_STOCK = 3
const OLD_CREDIT_DAYS = 7
const DAY_MS = 86_400_000

// Placeholder tints for products/categories without an image
const TINTS = ['#DCEFEA', '#EEF5C8', '#F3E6D8', '#E5E5E1']

function tintFor(id: string | null | undefined) {
  if (!id) return '#ECECE8'
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TINTS[h % TINTS.length]
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function localISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftDate(date: string, delta: number) {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return localISODate(d)
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Messages plus locale-aware formatters shared by every tab. */
function useStoreText() {
  const t = useT(storeMessages)
  const tc = useT(commonMessages)
  const intl = useIntlLocale()
  return {
    t,
    tc,
    intl,
    money: (n: number) => `$${n.toLocaleString(intl)}`,
    longDate: (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(intl, { weekday: 'long', day: 'numeric', month: 'short' }),
    monthName: (month: string) => {
      const [y, m] = month.split('-').map(Number)
      return new Date(y, m - 1, 1).toLocaleDateString(intl, { month: 'long', year: 'numeric' })
    },
    ageLabel: (days: number) => (days <= 0 ? t.today : days === 1 ? t.yesterday : t.days(days)),
  }
}

type StoreText = ReturnType<typeof useStoreText>

function niceCeil(n: number) {
  if (n <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(n))
  const s = n / p
  return (s <= 1 ? 1 : s <= 2 ? 2 : s <= 2.5 ? 2.5 : s <= 5 ? 5 : 10) * p
}

export function StoreTabs({ gymSlug, gymName, products, categories, dailyCut, monthlyCut, activeTab, dateParam, monthParam, members, pendingCredits, canDelete = false, canDeleteSales = false }: Props) {
  const router = useRouter()
  const { t } = useStoreText()
  const [tab, setTab] = useState(activeTab)

  function changeTab(id: TabId) {
    setTab(id)
    router.push(`?tab=${id}`)
  }

  const current = TABS.find(x => x.id === tab) ?? TABS[0]
  const creditMembers = new Set(pendingCredits.map(c => c.memberId)).size

  return (
    <div className="font-admin space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-admin-mono text-xs uppercase tracking-[0.08em] text-zinc-500">{t.eyebrow(gymName)}</p>
          <h1 className="text-4xl font-black leading-none tracking-tight">{t.tabs[current.id]}</h1>
        </div>
        <nav aria-label={t.sections} className="flex flex-wrap gap-1 rounded-2xl border border-zinc-200 bg-white p-1">
          {TABS.map(({ id, icon: Icon }) => {
            const active = current.id === id
            const label = t.tabs[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => changeTab(id)}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm transition-colors ${
                  active ? 'bg-black font-bold text-white hover:bg-zinc-800' : 'font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                {id === 'credits' && creditMembers > 0 && (
                  <span className="rounded-md bg-accent px-1.5 py-0.5 font-admin-mono text-[11px] font-bold text-accent-foreground">{creditMembers}</span>
                )}
              </button>
            )
          })}
        </nav>
      </header>

      {current.id === 'sell' && (
        <SellTab
          gymSlug={gymSlug}
          products={products.filter(p => p.isActive && p.stock > 0)}
          lowStock={products.filter(p => p.isActive && p.stock <= LOW_STOCK)}
          members={members}
          cut={dailyCut}
          dateParam={dateParam}
          pendingTotal={pendingCredits.reduce((s, c) => s + c.unitPrice * c.quantity, 0)}
          onNavigate={changeTab}
        />
      )}
      {current.id === 'credits' && <CreditsTab gymSlug={gymSlug} pendingCredits={pendingCredits} onNavigate={changeTab} />}
      {current.id === 'products' && <ProductsTab gymSlug={gymSlug} products={products} categories={categories} canDelete={canDelete} />}
      {current.id === 'categories' && <CategoriesTab gymSlug={gymSlug} categories={categories} products={products} monthlyCut={monthlyCut} monthParam={monthParam} canDelete={canDelete} />}
      {current.id === 'daily' && <DailyCutTab cut={dailyCut} dateParam={dateParam} gymSlug={gymSlug} canDelete={canDeleteSales} onNavigate={changeTab} />}
      {current.id === 'monthly' && <MonthlyCutTab cut={monthlyCut} monthParam={monthParam} gymSlug={gymSlug} canDelete={canDeleteSales} onNavigate={changeTab} />}
    </div>
  )
}

// ── Shared pieces ───────────────────────────────────────────
type Bar = { key: string; label: string; total: number; pct: number; color: string }

function methodBars(cut: CutSummary | null, s: StoreText, withCount = false): Bar[] {
  if (!cut || cut.total <= 0) return []
  return [...cut.byMethod]
    .sort((a, b) => b.total - a.total)
    .map(m => ({
      key: m.method,
      label: `${s.tc.methods[m.method] ?? m.method}${withCount ? ` · ${s.t.sales(m.count)}` : ''}`,
      total: m.total,
      pct: Math.round((m.total / cut.total) * 100),
      color: METHOD_COLORS[m.method] ?? '#A7C9C4',
    }))
}

function CashBand({ label, eyebrow, total, subtitle, bars, emptyBars, actions, children }: {
  label: string
  eyebrow: string
  total: number
  subtitle: string
  bars: Bar[]
  emptyBars?: string
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  const { t, money } = useStoreText()
  return (
    <section aria-label={label} className="flex flex-wrap items-stretch justify-between gap-6 rounded-[22px] bg-[#0E2A28] p-6 text-white sm:p-7">
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5">
        <p className="font-admin-mono text-xs uppercase tracking-[0.08em] text-[#A7C9C4]">{eyebrow}</p>
        <p className="font-admin-mono text-[44px] font-bold leading-none tracking-[-0.04em] sm:text-[56px]">{money(total)}</p>
        <p className="text-sm text-[#C9DEDA]">{subtitle}</p>
        {children}
      </div>
      <div className="flex min-w-0 flex-[1_1_320px] flex-col justify-between gap-4">
        {bars.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {bars.map(b => (
              <div key={b.key} title={`${b.label}: ${money(b.total)} (${b.pct}%)`} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-[13px]">
                  <span className="text-[#E2EFED]">{b.label}</span>
                  <span className="font-admin-mono font-bold">{money(b.total)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#1F4642]">
                  <div className="h-2 rounded-full" style={{ width: `${b.pct}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#A7C9C4]">{emptyBars ?? t.noSalesYet}</p>
        )}
        {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
      </div>
    </section>
  )
}

function BandButton({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={primary
        ? 'flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-extrabold text-accent-foreground transition-opacity hover:opacity-90'
        : 'flex h-11 items-center gap-2 rounded-xl border border-[#3F6B66] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10'}
    >
      {children}
    </button>
  )
}

function Panel({ title, action, className = '', children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-[18px] border border-zinc-200 bg-white ${className}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <h2 className="text-base font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function SearchField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex h-12 min-w-0 flex-[1_1_280px] items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 focus-within:ring-2 focus-within:ring-[#1fad9d]">
      <Search className="h-[18px] w-[18px] shrink-0 text-zinc-500" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-zinc-400"
        {...createHandlers('search')}
      />
    </label>
  )
}

function Chip({ active, onClick, count, children }: { active: boolean; onClick: () => void; count?: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
        active ? 'border-black bg-black text-white hover:bg-zinc-800' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
      }`}
    >
      {children}
      {count !== undefined && <span className="ml-1.5 font-admin-mono text-xs opacity-75">{count}</span>}
    </button>
  )
}

function EmptyState({ icon: Icon = Package, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 py-16 text-sm text-zinc-500">
      <Icon className="h-10 w-10 opacity-20" />
      {children}
    </div>
  )
}

function ShareBar({ pct, title }: { pct: number; title?: string }) {
  return (
    <span title={title} className="block h-1.5 overflow-hidden rounded-full bg-zinc-100">
      <span className="block h-1.5 rounded-full bg-[#1fad9d]" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  )
}

function MethodPicker({ value, onChange, dark }: { value: string; onChange: (v: string) => void; dark?: boolean }) {
  const { t, tc } = useStoreText()
  return (
    <div role="group" aria-label={t.paymentMethod} className="grid grid-cols-2 gap-2">
      {METHODS.map(v => {
        const label = tc.methods[v]
        const active = value === v
        const cls = dark
          ? active ? 'border-white bg-white text-[#111111] font-bold' : 'border-[#3A3A3A] text-[#E4E5E6] hover:border-[#5A5A5A]'
          : active ? 'border-black bg-black text-white hover:bg-zinc-800 font-bold' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
        return (
          <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={active}
            className={`h-11 rounded-[10px] border text-[13px] font-semibold transition-colors ${cls}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Sell Tab ────────────────────────────────────────────────
function SellTab({ gymSlug, products, lowStock, members, cut, dateParam, pendingTotal, onNavigate }: {
  gymSlug: string
  products: Product[]
  lowStock: Product[]
  members: Member[]
  cut: CutSummary | null
  dateParam: string
  pendingTotal: number
  onNavigate: (t: TabId) => void
}) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [mode, setMode] = useState<'sell' | 'credito'>('sell')
  const [method, setMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [memberId, setMemberId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const text = useStoreText()
  const { t, money, longDate } = text

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) return prev
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  function changeQty(productId: string, delta: number) {
    setCart(prev => prev
      .map(i => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0)
    )
  }

  const total = cart.reduce((s, i) => s + i.product.price * i.quantity, 0)
  const units = cart.reduce((s, i) => s + i.quantity, 0)

  const filteredMembers = memberSearch && !memberId
    ? members.filter(m =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearch.toLowerCase())
      ).slice(0, 8)
    : []

  const categoryChips = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const p of products) {
      if (!p.category) continue
      const entry = map.get(p.category.id) ?? { id: p.category.id, name: p.category.name, count: 0 }
      entry.count++
      map.set(p.category.id, entry)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [products])

  const q = query.trim().toLowerCase()
  const visible = products.filter(p =>
    (!categoryId || p.categoryId === categoryId) &&
    (!q || p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)),
  )

  function handleSell() {
    if (!cart.length) return
    startTransition(async () => {
      const result = await createSaleAction(gymSlug, {
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        method,
        notes: notes.trim() || undefined,
      })
      if (result.error) { toast.error(result.error); return }
      toast.success(t.sold)
      setCart([])
      setNotes('')
      router.refresh()
    })
  }

  function confirmAssign() {
    startTransition(async () => {
      const result = await assignCreditsAction(gymSlug, {
        memberId,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity })),
        notes: notes.trim() || undefined,
      })
      setShowConfirm(false)
      if (result.error) { toast.error(result.error); return }
      toast.success(t.creditAssigned)
      setCart([])
      setNotes('')
      setMemberId('')
      setMemberSearch('')
      router.refresh()
    })
  }

  const isToday = dateParam === localISODate(new Date())
  const salesCount = cut?.salesCount ?? 0
  const average = salesCount ? Math.round((cut?.total ?? 0) / salesCount) : 0
  const lowNames = lowStock.slice(0, 3).map(p => p.name).join(', ') + (lowStock.length > 3 ? t.andMore(lowStock.length - 3) : '')

  return (
    <div className="space-y-6">
      <CashBand
        label={t.todayCash}
        eyebrow={`${isToday ? t.todayCash : t.dayCash} · ${longDate(dateParam)}`}
        total={cut?.total ?? 0}
        subtitle={t.sellSubtitle(t.sales(salesCount), money(average), money(pendingTotal))}
        bars={methodBars(cut, text)}
        actions={
          <>
            <BandButton onClick={() => onNavigate('monthly')}>{t.seeMonthCut}</BandButton>
            <BandButton primary onClick={() => onNavigate('daily')}>{t.seeDayCut}</BandButton>
          </>
        }
      >
        {lowStock.length > 0 && (
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-[#E2EFED]">
            <span className="rounded-md bg-[#FDBA74] px-2 py-0.5 font-admin-mono text-[11px] font-bold text-[#111111]">{t.lowStock(lowStock.length)}</span>
            {lowNames}
          </p>
        )}
      </CashBand>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label={t.catalog} className="min-w-0 flex-[999_1_560px] space-y-4">
          {products.length === 0 ? (
            <EmptyState>{t.noStock}</EmptyState>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <SearchField label={t.searchProduct} value={query} onChange={setQuery} placeholder={t.searchProduct} />
              </div>
              {categoryChips.length > 0 && (
                <div role="group" aria-label={t.filterByCategory} className="flex flex-wrap gap-2">
                  <Chip active={!categoryId} onClick={() => setCategoryId(null)} count={products.length}>{t.all}</Chip>
                  {categoryChips.map(c => (
                    <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} count={c.count}>{c.name}</Chip>
                  ))}
                </div>
              )}
              {visible.length === 0 ? (
                <EmptyState icon={Search}>{t.noProductMatch}</EmptyState>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                  {visible.map(p => {
                    const inCart = cart.find(i => i.product.id === p.id)
                    const low = p.stock <= LOW_STOCK
                    const atMax = (inCart?.quantity ?? 0) >= p.stock
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addToCart(p)}
                        disabled={atMax}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md active:scale-[0.98] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
                      >
                        <div className="relative flex h-28 items-end p-3" style={p.imageUrl ? undefined : { background: tintFor(p.categoryId) }}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                          ) : p.category && (
                            <span className="font-admin-mono text-[11px] font-bold uppercase tracking-wider text-[#111111]/70">{p.category.name}</span>
                          )}
                          <span className={`absolute right-2.5 top-2.5 rounded-md px-2 py-0.5 font-admin-mono text-[11px] font-bold ${
                            low ? 'bg-[#111111] text-white' : 'bg-white/85 text-[#111111]'
                          }`}>
                            {low ? t.left(p.stock) : t.inStock(p.stock)}
                          </span>
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-3.5">
                          <span className="line-clamp-2 text-[15px] font-bold leading-tight">{p.name}</span>
                          <span className="mt-auto flex items-center justify-between gap-2">
                            <span className="font-admin-mono text-base font-bold">{money(p.price)}</span>
                            {inCart ? (
                              <span className="flex h-8 min-w-8 items-center justify-center rounded-[10px] bg-accent px-2 font-admin-mono text-sm font-bold text-accent-foreground">{inCart.quantity}</span>
                            ) : (
                              <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-black text-white transition-transform group-hover:scale-110">
                                <Plus className="h-4 w-4" />
                              </span>
                            )}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>

        <aside aria-label={t.currentTicket} className="flex max-w-full flex-[1_1_340px] flex-col overflow-hidden rounded-[20px] bg-[#111111] text-white ring-1 ring-white/10 lg:sticky lg:top-6">
          <div className="flex items-center justify-between px-[22px] pb-4 pt-5">
            <h2 className="text-xl font-extrabold tracking-tight">{t.ticket}</h2>
            <span className="font-admin-mono text-xs text-[#B5B7B9]">{t.articles(units)}</span>
          </div>

          <div role="group" aria-label={t.opType} className="mx-[22px] grid grid-cols-2 gap-1 rounded-xl bg-[#262626] p-1">
            <button type="button" onClick={() => setMode('sell')} aria-pressed={mode === 'sell'}
              className={`h-10 rounded-[9px] text-sm transition-colors ${mode === 'sell' ? 'bg-white font-bold text-[#111111]' : 'font-semibold text-[#D4D5D6] hover:text-white'}`}
            >
              {t.sale}
            </button>
            <button type="button" onClick={() => setMode('credito')} aria-pressed={mode === 'credito'}
              className={`h-10 rounded-[9px] text-sm transition-colors ${mode === 'credito' ? 'bg-[#FDBA74] font-bold text-[#111111]' : 'font-semibold text-[#D4D5D6] hover:text-white'}`}
            >
              {t.onCredit}
            </button>
          </div>

          {cart.length === 0 ? (
            <p className="px-[22px] py-8 text-center text-sm text-[#B5B7B9]">{t.tapProduct}</p>
          ) : (
            <ul className="mt-4 flex flex-col px-[22px]">
              {cart.map(({ product, quantity }) => (
                <li key={product.id} className="flex items-center gap-3 border-b border-dashed border-[#3A3A3A] py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{product.name}</p>
                    <p className="font-admin-mono text-xs text-[#B5B7B9]">{t.each(money(product.price))}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-[10px] bg-[#262626] p-0.5">
                    <button type="button" aria-label={t.removeOne(product.name)} onClick={() => changeQty(product.id, -1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-5 text-center font-admin-mono text-sm font-bold">{quantity}</span>
                    <button type="button" aria-label={t.addOne(product.name)} onClick={() => changeQty(product.id, 1)} disabled={quantity >= product.stock}
                      className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="w-[76px] text-right font-admin-mono text-sm font-bold">{money(product.price * quantity)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2.5 px-[22px] pt-[18px]">
            {mode === 'sell' ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#B5B7B9]">{t.paymentMethod}</p>
                <MethodPicker value={method} onChange={setMethod} dark />
              </>
            ) : (
              <div className="relative flex flex-col gap-1.5">
                <label htmlFor="credit-member" className="text-xs font-semibold uppercase tracking-[0.06em] text-[#B5B7B9]">{t.member}</label>
                <input
                  id="credit-member"
                  type="text"
                  placeholder={t.searchMember}
                  value={memberSearch}
                  onChange={e => { setMemberSearch(e.target.value); setMemberId('') }}
                  className="h-11 rounded-[10px] border border-[#3A3A3A] bg-[#1B1B1B] px-3.5 text-sm text-white outline-none placeholder:text-[#8A8C8E] focus:border-[#FDBA74]"
                  {...createHandlers('search')}
                />
                {filteredMembers.length > 0 && (
                  <div className="absolute top-full z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#3A3A3A] bg-[#1B1B1B] shadow-xl">
                    {filteredMembers.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setMemberId(m.id); setMemberSearch(`${m.firstName} ${m.lastName}`) }}
                        className="w-full border-b border-[#2E2E2E] px-3.5 py-2.5 text-left last:border-0 hover:bg-white/5"
                      >
                        <p className="text-sm font-semibold">{m.firstName} {m.lastName}</p>
                        <p className="text-xs text-[#B5B7B9]">{m.email}</p>
                      </button>
                    ))}
                  </div>
                )}
                {memberId && <p className="text-xs font-semibold text-[#FDBA74]">✓ {memberSearch}</p>}
              </div>
            )}
            <label htmlFor="sale-notes" className="mt-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[#B5B7B9]">{t.note}</label>
            <input
              id="sale-notes"
              type="text"
              placeholder={t.optional}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-11 rounded-[10px] border border-[#3A3A3A] bg-[#1B1B1B] px-3.5 text-sm text-white outline-none placeholder:text-[#8A8C8E] focus:border-white"
              {...createHandlers('text')}
            />
          </div>

          <div className="mt-5 flex flex-col gap-3.5 border-t border-[#2E2E2E] px-[22px] pb-[22px] pt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[#B5B7B9]">{mode === 'sell' ? t.total : t.creditTotal}</span>
              <span className="font-admin-mono text-4xl font-bold tracking-[-0.03em]">{money(total)}</span>
            </div>
            {mode === 'sell' ? (
              <button
                type="button"
                disabled={!cart.length || isPending}
                onClick={handleSell}
                className="h-14 rounded-[14px] bg-accent text-[17px] font-extrabold text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
              >
                {isPending ? t.processing : t.charge(money(total))}
              </button>
            ) : (
              <button
                type="button"
                disabled={!memberId || !cart.length || isPending}
                onClick={() => setShowConfirm(true)}
                className="h-14 rounded-[14px] bg-[#FDBA74] text-[17px] font-extrabold text-[#111111] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
              >
                {isPending ? t.assigning : t.giveCredit(money(total))}
              </button>
            )}
          </div>
        </aside>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={open => { if (!open) setShowConfirm(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmCredit}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.creditDebt(memberSearch)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2 space-y-1.5">
            {cart.map(({ product, quantity }) => (
              <div key={product.id} className="flex justify-between text-sm">
                <span className="text-zinc-700">{product.name} <span className="text-zinc-400">×{quantity}</span></span>
                <span className="font-semibold">{money(product.price * quantity)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-black border-t pt-2">
              <span>{t.debtTotal}</span>
              <span className="text-amber-600">{money(total)}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t.cancel}</AlertDialogCancel>
            <button onClick={confirmAssign} disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-all"
            >
              {isPending ? t.assigning : t.confirmCredit}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Products Tab ────────────────────────────────────────────
type ProductStatusFilter = 'all' | 'low' | 'inactive'

function ProductsTab({ gymSlug, products, categories, canDelete }: { gymSlug: string; products: Product[]; categories: Category[]; canDelete: boolean }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ProductStatusFilter>('all')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { t, money } = useStoreText()

  function handleSaved() {
    setModalOpen(false)
    setEditProduct(null)
    router.refresh()
  }

  function closeModal() {
    setModalOpen(false)
    setEditProduct(null)
  }

  function openNew() {
    setEditProduct(null)
    setModalOpen(true)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteProductAction(gymSlug, deleteTarget.id)
      setDeleteTarget(null)
      if (result.error) { toast.error(result.error); return }
      toast.success(t.productDeleted)
      router.refresh()
    })
  }

  const isLow = (p: Product) => p.isActive && p.stock <= LOW_STOCK
  const lowCount = products.filter(isLow).length
  const inactiveCount = products.filter(p => !p.isActive).length
  const maxStock = Math.max(1, ...products.map(p => p.stock))

  const q = query.trim().toLowerCase()
  const visible = products.filter(p =>
    (status === 'all' || (status === 'low' ? isLow(p) : !p.isActive)) &&
    (!categoryId || p.categoryId === categoryId) &&
    (!q || p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)),
  )

  const statusOptions: { id: ProductStatusFilter; label: string; count: number }[] = [
    { id: 'all', label: t.all, count: products.length },
    { id: 'low', label: t.lowStockFilter, count: lowCount },
    { id: 'inactive', label: t.inactiveFilter, count: inactiveCount },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField label={t.searchProduct} value={query} onChange={setQuery} placeholder={t.searchProduct} />
        <div role="group" aria-label={t.filterByStatus} className="flex gap-1 rounded-xl border border-zinc-200 bg-white p-1">
          {statusOptions.map(o => (
            <button key={o.id} type="button" onClick={() => setStatus(o.id)} aria-pressed={status === o.id}
              className={`h-10 rounded-[9px] px-3.5 text-[13px] transition-colors ${
                status === o.id ? 'bg-black font-bold text-white hover:bg-zinc-800' : 'font-semibold text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {o.label} <span className="font-admin-mono opacity-75">{o.count}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex h-12 items-center gap-2 rounded-xl bg-accent px-[18px] text-sm font-extrabold text-accent-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          {t.newProduct}
        </button>
      </div>

      {categories.length > 0 && (
        <div role="group" aria-label={t.filterByCategory} className="flex flex-wrap gap-2">
          <Chip active={!categoryId} onClick={() => setCategoryId(null)} count={products.length}>{t.allFem}</Chip>
          {categories.map(c => (
            <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} count={products.filter(p => p.categoryId === c.id).length}>{c.name}</Chip>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={open => { if (!open) closeModal() }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editProduct ? t.editProduct : t.newProduct}</DialogTitle>
          </DialogHeader>
          <ProductForm
            gymSlug={gymSlug}
            product={editProduct}
            categories={categories}
            onSave={handleSaved}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>

      {products.length === 0 ? (
        <EmptyState>{t.noProducts}</EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState icon={Search}>{t.noProductFilterMatch}</EmptyState>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          {visible.map(p => {
            const low = isLow(p)
            const margin = p.cost != null && p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : null
            return (
              <article key={p.id} className={`flex gap-3.5 rounded-2xl border border-zinc-200 bg-white p-3.5 ${p.isActive ? '' : 'opacity-70'}`}>
                <div className="relative flex w-[88px] shrink-0 items-end overflow-hidden rounded-xl p-2" style={p.imageUrl ? undefined : { background: tintFor(p.categoryId) }}>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : p.category && (
                    <span className="font-admin-mono text-[10px] font-bold uppercase tracking-wider text-[#111111]/70">{p.category.name}</span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-bold leading-tight">{p.name}</h3>
                      {p.description && <p className="truncate text-xs text-zinc-500">{p.description}</p>}
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 font-admin-mono text-[11px] font-bold ${
                      p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {p.isActive ? t.active : t.inactive}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-2.5">
                    <span className="font-admin-mono text-xl font-bold">{money(p.price)}</span>
                    <span className="text-xs text-zinc-500">
                      {p.cost != null ? t.costMargin(money(p.cost), margin) : t.noCost}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <span className={`block h-1.5 rounded-full ${low ? 'bg-[#C2410C]' : 'bg-[#1fad9d]'}`} style={{ width: `${Math.round((p.stock / maxStock) * 100)}%` }} />
                    </span>
                    <span className={`font-admin-mono text-xs ${low ? 'font-bold text-amber-700' : 'text-zinc-600'}`}>
                      {p.stock === 0 ? t.outOfStock : low ? t.left(p.stock) : t.inStock(p.stock)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-500">{t.soldCount(p._count.saleItems)}</span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        aria-label={t.edit(p.name)}
                        onClick={() => { setEditProduct(p); setModalOpen(true) }}
                        className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 text-zinc-600 transition-colors hover:border-zinc-300 hover:text-black"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={t.delete(p.name)}
                          disabled={isPending}
                          onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-zinc-200 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </article>
            )
          })}
          <button
            type="button"
            onClick={openNew}
            className="flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 text-sm font-bold text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900"
          >
            <Plus className="h-5 w-5" />
            {t.addProduct}
          </button>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteProductTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteProductBody(deleteTarget?.name ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t.cancel}</AlertDialogCancel>
            <button
              onClick={confirmDelete}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-all"
            >
              {isPending ? t.deleting : t.deleteBtn}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Product Form ────────────────────────────────────────────
function ProductForm({ gymSlug, product, categories, onSave, onCancel }: {
  gymSlug: string
  product: Product | null
  categories: Category[]
  onSave: () => void
  onCancel: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { t } = useStoreText()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const data = {
      name: fd.get('name') as string,
      description: fd.get('description') as string,
      imageUrl: fd.get('imageUrl') as string,
      price: parseFloat(fd.get('price') as string),
      cost: fd.get('cost') ? parseFloat(fd.get('cost') as string) : undefined,
      stock: parseInt(fd.get('stock') as string, 10),
      categoryId: fd.get('categoryId') as string,
      isActive: fd.get('isActive') === 'true',
    }

    startTransition(async () => {
      const result = product
        ? await updateProductAction(gymSlug, product.id, data)
        : await createProductAction(gymSlug, data)

      if (result.error) { setError(result.error); return }
      toast.success(product ? t.productUpdated : t.productCreated)
      onSave()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label={t.nameReq} name="name" defaultValue={product?.name} placeholder={t.namePlaceholder} />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600">{t.category}</label>
            <select
              name="categoryId"
              defaultValue={product?.categoryId ?? ''}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
            >
              <option value="">{t.noCategory}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <FormField label={t.description} name="description" defaultValue={product?.description ?? ''} placeholder={t.descriptionPlaceholder} fieldType="text" />
        <FormField label={t.imageUrl} name="imageUrl" defaultValue={product?.imageUrl ?? ''} placeholder="https://..." fieldType="url" />
        <div className="grid grid-cols-3 gap-3">
          <FormField label={t.priceReq} name="price" type="number" defaultValue={String(product?.price ?? '')} placeholder="500" min="0.01" step="0.01" fieldType="price" />
          <FormField label={t.cost} name="cost" type="number" defaultValue={String(product?.cost ?? '')} placeholder="300" min="0" step="0.01" fieldType="price" />
          <FormField label={t.stockReq} name="stock" type="number" defaultValue={String(product?.stock ?? '0')} placeholder="10" min="0" step="1" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold">{t.statusLabel}</label>
          <select name="isActive" defaultValue={String(product?.isActive ?? true)} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm">
            <option value="true">{t.active}</option>
            <option value="false">{t.inactive}</option>
          </select>
        </div>
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={isPending} className="rounded-xl bg-black px-5 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
            {isPending ? t.saving : t.save}
          </button>
          <button type="button" onClick={onCancel} className="rounded-xl border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
            {t.cancel}
          </button>
        </div>
      </form>
  )
}

function FormField({ label, name, type = 'text', defaultValue, placeholder, min, step, fieldType }: {
  label: string; name: string; type?: string; defaultValue?: string; placeholder?: string; min?: string; step?: string; fieldType?: FieldType
}) {
  const effectiveFieldType: FieldType = fieldType ?? inferFieldType(type)
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-zinc-600">{label}</label>
      <input
        name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} min={min} step={step}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
        {...createHandlers(effectiveFieldType)}
      />
    </div>
  )
}

// ── Categories Tab ──────────────────────────────────────────
function CategoriesTab({ gymSlug, categories, products, monthlyCut, monthParam, canDelete }: {
  gymSlug: string
  categories: Category[]
  products: Product[]
  monthlyCut: CutSummary | null
  monthParam: string
  canDelete: boolean
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [isPending, startTransition] = useTransition()
  const { t, money, monthName } = useStoreText()

  function handleSaved() {
    setModalOpen(false)
    setEditCategory(null)
    router.refresh()
  }

  function closeModal() {
    setModalOpen(false)
    setEditCategory(null)
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCategoryAction(gymSlug, id)
      if (result.error) { toast.error(result.error); return }
      toast.success(t.categoryDeleted)
      router.refresh()
    })
  }

  // Month revenue per category, from the sales in the monthly cut
  const revenueByCategory = useMemo(() => {
    const categoryOf = new Map(products.map(p => [p.id, p.categoryId]))
    const totals = new Map<string, number>()
    for (const sale of monthlyCut?.sales ?? []) {
      for (const item of sale.items) {
        const cat = categoryOf.get(item.productId)
        if (!cat) continue
        totals.set(cat, (totals.get(cat) ?? 0) + item.unitPrice * item.quantity)
      }
    }
    return totals
  }, [products, monthlyCut])

  const storeTotal = monthlyCut?.total ?? 0

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section aria-label={t.categories} className="min-w-0 flex-[999_1_560px] space-y-4">
        <p className="text-sm text-zinc-500">
          {t.categoriesCount(categories.length)} · {t.products(products.length)} · {t.salesOf(monthName(monthParam))}
        </p>

        {categories.length === 0 ? (
          <EmptyState icon={Tag}>{t.noCategories}</EmptyState>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {categories.map(c => {
              const items = products.filter(p => p.categoryId === c.id)
              const revenue = revenueByCategory.get(c.id) ?? 0
              const share = storeTotal > 0 ? Math.round((revenue / storeTotal) * 100) : 0
              const names = items.slice(0, 3).map(p => p.name).join(', ') + (items.length > 3 ? '…' : '')
              return (
                <article key={c.id} className="flex flex-col overflow-hidden rounded-[18px] border border-zinc-200 bg-white">
                  <div className="relative flex h-[140px] items-end p-4" style={c.imageUrl ? undefined : { background: tintFor(c.id) }}>
                    {c.imageUrl && (
                      <>
                        <img src={c.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      </>
                    )}
                    <h2 className={`relative text-[26px] font-black tracking-tight ${c.imageUrl ? 'text-white' : 'text-[#111111]'}`}>{c.name}</h2>
                    <span className="absolute right-3 top-3 flex gap-1">
                      <button
                        type="button"
                        aria-label={t.edit(c.name)}
                        onClick={() => { setEditCategory(c); setModalOpen(true) }}
                        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/85 text-[#111111] transition-colors hover:bg-white"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={t.delete(c.name)}
                          disabled={isPending}
                          onClick={() => handleDelete(c.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/85 text-[#9A3412] transition-colors hover:bg-white disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-admin-mono text-[22px] font-bold">{money(revenue)}</span>
                      <span className="text-[13px] text-zinc-500">{t.storeShare(share)}</span>
                    </div>
                    <ShareBar pct={share} title={t.monthShare(c.name, share)} />
                    <p className="text-[13px] text-zinc-600">
                      {items.length === 0 ? t.noProductsInCategory : `${t.products(items.length)} · ${names}`}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <NewCategoryPanel gymSlug={gymSlug} />

      <Dialog open={modalOpen} onOpenChange={open => { if (!open) closeModal() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.editCategory}</DialogTitle>
          </DialogHeader>
          <CategoryForm
            gymSlug={gymSlug}
            category={editCategory}
            onSave={handleSaved}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NewCategoryPanel({ gymSlug }: { gymSlug: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { t } = useStoreText()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createCategoryAction(gymSlug, { name, imageUrl })
      if (result.error) { setError(result.error); return }
      toast.success(t.categoryCreated)
      setName('')
      setImageUrl('')
      router.refresh()
    })
  }

  const preview = imageUrl.startsWith('https://') ? imageUrl : ''
  const inputCls = 'h-11 rounded-[10px] border border-[#3A3A3A] bg-[#1B1B1B] px-3.5 text-sm text-white outline-none placeholder:text-[#8A8C8E] focus:border-white'

  return (
    <aside aria-labelledby="new-category" className="max-w-full flex-[1_1_340px] rounded-[20px] bg-[#111111] p-[22px] text-white ring-1 ring-white/10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 id="new-category" className="text-xl font-extrabold">{t.newCategory}</h2>
        <div className="relative flex h-[140px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[14px] border-2 border-dashed border-[#3A3A3A] text-[13px] text-[#B5B7B9]">
          {preview ? (
            <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              {t.imagePreview}
            </>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-category-name" className="text-xs font-semibold uppercase tracking-[0.06em] text-[#B5B7B9]">{t.name}</label>
          <input id="new-category-name" required value={name} onChange={e => setName(e.target.value)} placeholder={t.categoryPlaceholder} className={inputCls} {...createHandlers('text')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-category-image" className="text-xs font-semibold uppercase tracking-[0.06em] text-[#B5B7B9]">{t.imageUrl}</label>
          <input id="new-category-image" type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className={inputCls} {...createHandlers('url')} />
        </div>
        {error && <p className="text-xs font-medium text-[#FCA5A5]">{error}</p>}
        <button type="submit" disabled={isPending || !name.trim()}
          className="h-[52px] rounded-[14px] bg-accent text-[15px] font-extrabold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? t.creating : t.createCategory}
        </button>
      </form>
    </aside>
  )
}

// ── Category Form ───────────────────────────────────────────
function CategoryForm({ gymSlug, category, onSave, onCancel }: {
  gymSlug: string
  category: Category | null
  onSave: () => void
  onCancel: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { t } = useStoreText()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const data = {
      name: fd.get('name') as string,
      imageUrl: fd.get('imageUrl') as string,
    }

    startTransition(async () => {
      const result = category
        ? await updateCategoryAction(gymSlug, category.id, data)
        : await createCategoryAction(gymSlug, data)

      if (result.error) { setError(result.error); return }
      toast.success(category ? t.categoryUpdated : t.categoryCreated)
      onSave()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label={t.nameReq} name="name" defaultValue={category?.name} placeholder={t.categoryPlaceholder} />
        <FormField label={t.imageUrl} name="imageUrl" defaultValue={category?.imageUrl ?? ''} placeholder="https://..." fieldType="url" />
      </div>
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={isPending} className="rounded-xl bg-black px-5 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
          {isPending ? t.saving : t.save}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
          {t.cancel}
        </button>
      </div>
    </form>
  )
}

// ── Credits Tab ─────────────────────────────────────────────
type CreditGroup = {
  memberId: string
  name: string
  items: PendingCredit[]
  total: number
  oldestDays: number
}

function CreditsTab({ gymSlug, pendingCredits, onNavigate }: {
  gymSlug: string
  pendingCredits: PendingCredit[]
  onNavigate: (t: TabId) => void
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [onlyOld, setOnlyOld] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [inlineMethod, setInlineMethod] = useState('CASH')
  const [payTarget, setPayTarget] = useState<{ creditIds: string[]; memberName: string; total: number; memberId: string } | null>(null)
  const [payMethod, setPayMethod] = useState('CASH')
  const [isPending, startTransition] = useTransition()
  const { t, money, ageLabel, intl } = useStoreText()

  const { groups, aging, grandTotal } = useMemo(() => {
    const now = new Date().getTime()
    const ageOf = (c: PendingCredit) => Math.max(0, Math.floor((now - new Date(c.createdAt).getTime()) / DAY_MS))
    const map = new Map<string, CreditGroup>()
    const buckets = { today: 0, week: 0, old: 0 }
    for (const c of pendingCredits) {
      const amount = c.unitPrice * c.quantity
      const days = ageOf(c)
      if (days === 0) buckets.today += amount
      else if (days <= OLD_CREDIT_DAYS) buckets.week += amount
      else buckets.old += amount
      const g = map.get(c.memberId) ?? { memberId: c.memberId, name: `${c.member.firstName} ${c.member.lastName}`, items: [], total: 0, oldestDays: 0 }
      g.items.push(c)
      g.total += amount
      g.oldestDays = Math.max(g.oldestDays, days)
      map.set(c.memberId, g)
    }
    const total = buckets.today + buckets.week + buckets.old
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)
    return {
      groups: [...map.values()].sort((a, b) => b.oldestDays - a.oldestDays),
      grandTotal: total,
      aging: [
        { key: 'today', label: t.today, total: buckets.today, pct: pct(buckets.today), color: '#FFFFFF' },
        { key: 'week', label: t.oneToDays(OLD_CREDIT_DAYS), total: buckets.week, pct: pct(buckets.week), color: '#5EEAD4' },
        { key: 'old', label: t.moreThanDays(OLD_CREDIT_DAYS), total: buckets.old, pct: pct(buckets.old), color: '#FDBA74' },
      ],
    }
  }, [pendingCredits, t])

  const oldCount = groups.filter(g => g.oldestDays > OLD_CREDIT_DAYS).length
  const q = search.trim().toLowerCase()
  const filtered = groups.filter(g => (!onlyOld || g.oldestDays > OLD_CREDIT_DAYS) && (!q || g.name.toLowerCase().includes(q)))

  function pay(creditIds: string[], method: string, memberId: string) {
    startTransition(async () => {
      const result = await payCreditsAction(gymSlug, creditIds, method, memberId)
      setPayTarget(null)
      if (result.error) { toast.error(result.error); return }
      toast.success(t.creditsPaid)
      router.refresh()
    })
  }

  if (groups.length === 0) {
    return (
      <EmptyState icon={CreditCard}>
        {t.noCredits}
        <button type="button" onClick={() => onNavigate('sell')} className="mt-2 text-sm font-bold text-[#0e7a70] hover:underline">{t.giveProducts}</button>
      </EmptyState>
    )
  }

  const oldest = groups[0]?.oldestDays ?? 0

  return (
    <div className="space-y-6">
      <CashBand
        label={t.creditsSummary}
        eyebrow={t.toCollect}
        total={grandTotal}
        subtitle={t.creditsSubtitle(t.members(groups.length), t.creditItems(pendingCredits.length), oldest === 0 ? t.fromToday : t.daysAgo(t.days(oldest)))}
        bars={aging}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchField label={t.searchMemberLabel} value={search} onChange={setSearch} placeholder={t.searchMemberLabel} />
        <div role="group" aria-label={t.filter} className="flex gap-2">
          <Chip active={!onlyOld} onClick={() => setOnlyOld(false)} count={groups.length}>{t.all}</Chip>
          <Chip active={onlyOld} onClick={() => setOnlyOld(true)} count={oldCount}>{t.moreThanDays(OLD_CREDIT_DAYS)}</Chip>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('sell')}
          className="flex h-12 items-center gap-2 rounded-xl bg-black px-[18px] text-sm font-bold text-white transition-colors hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
          {t.giveProducts}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Search}>{t.noMemberMatch}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filtered.map(g => {
            const isOpen = openId === g.memberId
            const old = g.oldestDays > OLD_CREDIT_DAYS
            return (
              <li key={g.memberId} className={`overflow-hidden rounded-2xl border bg-white ${isOpen ? 'border-zinc-900' : 'border-zinc-200'}`}>
                <div className="flex flex-wrap items-center gap-4 px-[18px] py-3.5">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : g.memberId)}
                    aria-expanded={isOpen}
                    className="flex min-h-11 min-w-0 flex-[1_1_280px] items-center gap-3.5 text-left"
                  >
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[13px] font-extrabold">{initials(g.name)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold">{g.name}</span>
                      <span className="block text-[13px] text-zinc-500">{t.pendingItems(g.items.length)}</span>
                    </span>
                    <span className={`ml-auto shrink-0 rounded-md px-2 py-1 font-admin-mono text-[11px] font-bold ${old ? 'bg-[#FDBA74] text-[#111111]' : 'bg-zinc-100 text-zinc-900'}`}>
                      {ageLabel(g.oldestDays)}
                    </span>
                  </button>
                  <span className="w-24 text-right font-admin-mono text-lg font-bold">{money(g.total)}</span>
                  <button
                    type="button"
                    onClick={() => setPayTarget({ creditIds: g.items.map(c => c.id), memberName: g.name, total: g.total, memberId: g.memberId })}
                    className="h-11 rounded-xl border border-current px-4 text-sm font-bold transition-colors hover:bg-zinc-50"
                  >
                    {t.chargeAll}
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-zinc-100 bg-zinc-50/50">
                    <ul className="px-[18px]">
                      {g.items.map(credit => (
                        <li key={credit.id} className="flex flex-wrap items-center gap-3 border-b border-dashed border-zinc-200 py-3 sm:pl-[54px]">
                          <span className="min-w-0 flex-[1_1_200px] text-sm font-semibold">
                            {credit.product.name} <span className="font-admin-mono font-medium text-zinc-500">×{credit.quantity}</span>
                            {credit.notes && <span className="block text-xs font-normal italic text-zinc-500">{credit.notes}</span>}
                          </span>
                          <span className="text-[13px] text-zinc-500">{new Date(credit.createdAt).toLocaleDateString(intl, { day: 'numeric', month: 'short' })}</span>
                          <span className="w-20 text-right font-admin-mono text-sm font-bold">{money(credit.unitPrice * credit.quantity)}</span>
                          <button
                            type="button"
                            onClick={() => setPayTarget({ creditIds: [credit.id], memberName: g.name, total: credit.unitPrice * credit.quantity, memberId: g.memberId })}
                            className="h-9 rounded-[10px] border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-600 transition-colors hover:border-zinc-300"
                          >
                            {t.chargeOne}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center justify-end gap-2.5 px-[18px] py-3.5">
                      <span className="mr-auto text-[13px] text-zinc-500 sm:pl-[54px]">{t.chargeAllWith}</span>
                      <div className="w-full sm:w-auto sm:min-w-[280px]">
                        <MethodPicker value={inlineMethod} onChange={setInlineMethod} />
                      </div>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => pay(g.items.map(c => c.id), inlineMethod, g.memberId)}
                        className="h-11 rounded-xl bg-accent px-[18px] text-sm font-extrabold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        {isPending ? t.processing : t.charge(money(g.total))}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <AlertDialog open={!!payTarget} onOpenChange={open => { if (!open) setPayTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.chargeCredit}</AlertDialogTitle>
            <AlertDialogDescription>
              {payTarget?.memberName} — {money(payTarget?.total ?? 0)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{t.paymentMethod}</p>
            <MethodPicker value={payMethod} onChange={setPayMethod} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t.cancel}</AlertDialogCancel>
            <button onClick={() => payTarget && pay(payTarget.creditIds, payMethod, payTarget.memberId)} disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl bg-[#1fad9d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0e7a70] disabled:opacity-50 transition-all"
            >
              {isPending ? t.processing : t.charge(money(payTarget?.total ?? 0))}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Cut Tabs ────────────────────────────────────────────────
function PeriodStepper({ type, value, onChange }: { type: 'date' | 'month'; value: string; onChange: (v: string) => void }) {
  const { t } = useStoreText()
  const now = new Date()
  const max = type === 'date' ? localISODate(now) : localISODate(now).slice(0, 7)
  const shift = (d: number) => (type === 'date' ? shiftDate(value, d) : shiftMonth(value, d))
  const unit = type === 'date' ? t.day : t.month
  const stepCls = 'flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white transition-colors hover:border-zinc-300 disabled:opacity-40'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-label={t.prev(unit)} onClick={() => onChange(shift(-1))} className={stepCls}>
        <ChevronLeft className="h-[18px] w-[18px]" />
      </button>
      <label className="sr-only" htmlFor={`period-${type}`}>{type === 'date' ? t.cutDate : t.cutMonth}</label>
      <input
        id={`period-${type}`}
        type={type}
        value={value}
        max={max}
        onChange={e => { if (e.target.value) onChange(e.target.value) }}
        className="h-11 rounded-xl border border-zinc-200 bg-white px-3.5 text-[15px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
      />
      <button type="button" aria-label={t.next(unit)} onClick={() => onChange(shift(1))} disabled={value >= max} className={stepCls}>
        <ChevronRight className="h-[18px] w-[18px]" />
      </button>
      {value !== max && (
        <button type="button" onClick={() => onChange(max)} className="h-11 rounded-xl px-3.5 text-sm font-bold text-[#0e7a70] hover:bg-zinc-100">
          {type === 'date' ? t.today : t.thisMonth}
        </button>
      )}
    </div>
  )
}

function SalesPanel({ sales, gymSlug, canDelete, showDate }: { sales: Sale[]; gymSlug: string; canDelete: boolean; showDate?: boolean }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null)
  const [isPending, startTransition] = useTransition()
  const { t, tc, money, intl } = useStoreText()

  function confirmDeleteSale() {
    if (!deleteTarget) return
    startTransition(async () => {
      const result = await deleteSaleAction(gymSlug, deleteTarget.id)
      setDeleteTarget(null)
      if (result.error) { toast.error(result.error); return }
      toast.success(t.saleDeleted)
      router.refresh()
    })
  }

  const sorted = [...sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const shown = expanded ? sorted : sorted.slice(0, 8)

  return (
    <Panel
      title={t.salesDetail}
      action={sorted.length > 8 && (
        <button type="button" onClick={() => setExpanded(e => !e)} className="text-[13px] font-bold text-[#0e7a70] hover:underline">
          {expanded ? t.seeLess : t.seeAll(sorted.length)}
        </button>
      )}
    >
      <ul className="px-5 pb-2">
        {shown.map(sale => {
          const d = new Date(sale.createdAt)
          const time = d.toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' })
          const when = showDate ? `${d.toLocaleDateString(intl, { day: '2-digit', month: '2-digit' })} ${time}` : time
          return (
            <li key={sale.id} className="flex items-center gap-3 border-b border-dashed border-zinc-200 py-2.5 last:border-0">
              <span className="shrink-0 font-admin-mono text-[13px] text-zinc-500">{when}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{sale.items.map(i => `${i.product.name} ×${i.quantity}`).join(', ')}</span>
                <span className="block text-xs text-zinc-500">
                  {tc.methods[sale.method] ?? sale.method}
                  {sale.notes && <span className="italic"> — {sale.notes}</span>}
                </span>
              </span>
              <span className="font-admin-mono text-sm font-bold">{money(sale.total)}</span>
              {canDelete && (
                <button
                  type="button"
                  aria-label={t.voidSaleAt(time)}
                  disabled={isPending}
                  onClick={() => setDeleteTarget(sale)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.voidSaleTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.voidSaleBody(money(deleteTarget?.total ?? 0))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t.cancel}</AlertDialogCancel>
            <button
              onClick={confirmDeleteSale}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-all"
            >
              {isPending ? t.voiding : t.voidSale}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  )
}

function ProductBreakdown({ title, rows, limit }: { title: string; rows: CutSummary['byProduct']; limit?: number }) {
  const { t, money } = useStoreText()
  const sorted = [...rows].sort((a, b) => b.total - a.total).slice(0, limit)
  const max = sorted[0]?.total ?? 0
  return (
    <Panel title={title}>
      <ol className="px-5 pb-4 pt-2">
        {sorted.map((p, i) => (
          <li key={`${p.name}-${i}`} title={t.unitsTotal(p.name, p.quantity, money(p.total))}
            className="grid grid-cols-[minmax(0,1fr)_56px_88px] items-center gap-3 border-b border-dashed border-zinc-200 py-2.5 last:border-0"
          >
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="truncate text-sm font-semibold">{p.name}</span>
              <ShareBar pct={max > 0 ? (p.total / max) * 100 : 0} />
            </span>
            <span className="text-right font-admin-mono text-[13px] text-zinc-600">×{p.quantity}</span>
            <span className="text-right font-admin-mono text-sm font-bold">{money(p.total)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

function CreditsInPeriod({ credits, title, onNavigate }: { credits: CutSummary['credits']; title: string; onNavigate: (t: TabId) => void }) {
  const { t, money } = useStoreText()
  const top = [...credits.byMember].sort((a, b) => b.total - a.total)
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-5 py-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-extrabold text-amber-900">{title}</h2>
        <span className="font-admin-mono text-[22px] font-bold text-amber-900">{money(credits.total)}</span>
      </div>
      <p className="text-[13px] text-amber-800">
        {t.creditsNote(t.products(credits.count), t.members(credits.byMember.length))}
      </p>
      {top.length > 0 && (
        <ul>
          {top.slice(0, 5).map((m, i) => (
            <li key={`${m.memberName}-${i}`} className="flex justify-between gap-3 border-t border-amber-200 py-2 text-sm text-amber-900">
              <span className="font-semibold">{m.memberName}</span>
              <span className="font-admin-mono font-bold">{money(m.total)}</span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => onNavigate('credits')} className="self-start text-[13px] font-bold text-amber-900 hover:underline">
        {t.seeCredits}
      </button>
    </section>
  )
}

function DailyCutTab({ cut, dateParam, gymSlug, canDelete, onNavigate }: {
  cut: CutSummary | null; dateParam: string; gymSlug: string; canDelete: boolean; onNavigate: (t: TabId) => void
}) {
  const router = useRouter()
  const text = useStoreText()
  const { t, money, longDate } = text
  const isToday = dateParam === localISODate(new Date())
  const salesCount = cut?.salesCount ?? 0
  const units = cut?.byProduct.reduce((s, p) => s + p.quantity, 0) ?? 0
  const average = salesCount ? Math.round((cut?.total ?? 0) / salesCount) : 0
  const hasCredits = (cut?.credits?.count ?? 0) > 0

  return (
    <div className="space-y-6">
      <PeriodStepper type="date" value={dateParam} onChange={v => router.push(`?tab=daily&date=${v}`)} />

      <CashBand
        label={t.dayTotal}
        eyebrow={`${longDate(dateParam)}${isToday ? t.inProgress : ''}`}
        total={cut?.total ?? 0}
        subtitle={t.daySubtitle(t.sales(salesCount), t.units(units), money(average))}
        bars={methodBars(cut, text, true)}
        emptyBars={t.noSalesDay}
        actions={<BandButton onClick={() => window.print()}><Printer className="h-4 w-4" />{t.print}</BandButton>}
      />

      {salesCount === 0 && !hasCredits ? (
        <EmptyState icon={Calendar}>{t.noMovesDay}</EmptyState>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          {(cut?.byProduct.length ?? 0) > 0 && (
            <div className="min-w-0 flex-[1_1_420px]">
              <ProductBreakdown title={t.byProduct} rows={cut!.byProduct} />
            </div>
          )}
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
            {(cut?.sales.length ?? 0) > 0 && <SalesPanel sales={cut!.sales} gymSlug={gymSlug} canDelete={canDelete} />}
            {hasCredits && <CreditsInPeriod credits={cut!.credits} title={t.creditThisDay} onNavigate={onNavigate} />}
          </div>
        </div>
      )}
    </div>
  )
}

function MonthlyCutTab({ cut, monthParam, gymSlug, canDelete, onNavigate }: {
  cut: CutSummary | null; monthParam: string; gymSlug: string; canDelete: boolean; onNavigate: (t: TabId) => void
}) {
  const router = useRouter()
  const text = useStoreText()
  const { t, money, monthName } = text
  const [y, m] = monthParam.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const now = new Date()
  const isCurrent = localISODate(now).slice(0, 7) === monthParam
  const lastDay = isCurrent ? now.getDate() : daysInMonth
  const salesCount = cut?.salesCount ?? 0
  const total = cut?.total ?? 0
  const average = salesCount ? Math.round(total / salesCount) : 0
  const perDay = lastDay > 0 ? Math.round(total / lastDay) : 0
  const hasCredits = (cut?.credits?.count ?? 0) > 0
  const name = monthName(monthParam)

  return (
    <div className="space-y-6">
      <PeriodStepper type="month" value={monthParam} onChange={v => router.push(`?tab=monthly&month=${v}`)} />

      <CashBand
        label={t.monthTotal}
        eyebrow={`${name}${isCurrent ? t.monthRange(lastDay) : ''}`}
        total={total}
        subtitle={t.monthSubtitle(t.sales(salesCount), money(average), money(perDay))}
        bars={methodBars(cut, text)}
        emptyBars={t.noSalesMonth}
      />

      {salesCount === 0 && !hasCredits ? (
        <EmptyState icon={BarChart2}>{t.noMovesMonth}</EmptyState>
      ) : (
        <>
          {salesCount > 0 && <DailySalesChart sales={cut!.sales} year={y} month={m} daysInMonth={daysInMonth} lastDay={lastDay} today={isCurrent ? lastDay : null} />}
          <div className="flex flex-wrap items-start gap-6">
            {(cut?.byProduct.length ?? 0) > 0 && (
              <div className="min-w-0 flex-[1_1_420px]">
                <ProductBreakdown title={t.topProducts} rows={cut!.byProduct} limit={5} />
              </div>
            )}
            {hasCredits && (
              <div className="min-w-0 flex-[1_1_420px]">
                <CreditsInPeriod credits={cut!.credits} title={t.creditIn(name.split(' ')[0])} onNavigate={onNavigate} />
              </div>
            )}
          </div>
          {salesCount > 0 && <SalesPanel sales={cut!.sales} gymSlug={gymSlug} canDelete={canDelete} showDate />}
        </>
      )}
    </div>
  )
}

function DailySalesChart({ sales, year, month, daysInMonth, lastDay, today }: { sales: Sale[]; year: number; month: number; daysInMonth: number; lastDay: number; today: number | null }) {
  const { t, money, intl } = useStoreText()
  const totals = Array<number>(daysInMonth).fill(0)
  for (const s of sales) {
    const d = new Date(s.createdAt)
    if (d.getFullYear() === year && d.getMonth() === month - 1) totals[d.getDate() - 1] += s.total
  }
  const max = Math.max(0, ...totals)
  const scaleMax = niceCeil(max)
  const best = totals.indexOf(max)
  const monthShort = new Date(year, month - 1, 1).toLocaleDateString(intl, { month: 'short' })
  const bestLabel = max > 0
    ? new Date(year, month - 1, best + 1).toLocaleDateString(intl, { weekday: 'short', day: 'numeric', month: 'short' })
    : ''

  return (
    <Panel title={t.salesPerDay} action={max > 0 && <span className="text-[13px] text-zinc-500">{t.bestDay(bestLabel, money(max))}</span>}>
      <div className="overflow-x-auto px-5 pb-4 pt-2">
        <div className="flex min-w-[640px] gap-3">
          <div aria-hidden="true" className="flex h-[200px] w-14 flex-col justify-between pt-6 text-right font-admin-mono text-[11px] text-zinc-500">
            <span className="-translate-y-1/2">{money(scaleMax)}</span>
            <span className="-translate-y-1/2">{money(scaleMax / 2)}</span>
            <span className="translate-y-1/2">$0</span>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <div
              role="img"
              aria-label={t.dailyAria(monthShort, bestLabel, money(max))}
              className="relative flex h-[200px] items-end gap-1 border-b border-zinc-300 pt-6"
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-6 border-t border-zinc-100" />
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[calc(24px+(100%-24px)/2)] border-t border-zinc-100" />
              {totals.map((v, i) => {
                const day = i + 1
                const future = day > lastDay
                const pct = (v / scaleMax) * 100
                return (
                  <div key={day} className="group relative flex h-full flex-1 items-end">
                    {future ? (
                      <div className="h-1 w-full rounded-sm border border-dashed border-zinc-300" />
                    ) : (
                      <div
                        className={`w-full rounded-t-[4px] ${v === 0 ? 'bg-zinc-200' : day === today ? 'bg-[#0e7a70]' : 'bg-[#1fad9d]'}`}
                        style={{ height: v > 0 ? `${pct}%` : '2px' }}
                      />
                    )}
                    {!future && (
                      <span
                        className="pointer-events-none absolute left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#111111] px-2 py-1 font-admin-mono text-[11px] text-white group-hover:block"
                        style={{ bottom: `calc(${v > 0 ? pct : 0}% + 6px)` }}
                      >
                        {day} {monthShort} · {money(v)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <div aria-hidden="true" className="flex gap-1 font-admin-mono text-[11px] text-zinc-500">
              {totals.map((_, i) => (
                <span key={i} className="flex-1 text-center">{i === 0 || (i + 1) % 5 === 0 ? i + 1 : ''}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}
