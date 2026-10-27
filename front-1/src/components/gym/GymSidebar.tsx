'use client'

import { useEffect, useRef, useState, useTransition, type RefObject } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  CheckSquare,
  UserCheck,
  Calendar,
  Box,
  BarChart2,
  Megaphone,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Moon,
  Sun,
  ShoppingCart,
  LifeBuoy,
  QrCode,
  Search,
  Compass,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/lib/logout'
import { useTheme } from '@/components/providers/ThemeProvider'
import { GymMark, initials } from '@/components/admin/ui'
import { TOUR_START_EVENT } from '@/components/gym/GymTour'
import { useT } from '@/i18n/client'
import { shellMessages } from './messages'

type NavKey = keyof (typeof shellMessages)['es']['nav']
type NavItem = { label: NavKey; icon: LucideIcon; path: string }
type NavGroup = { label: NavKey; items: NavItem[]; storeItem?: NavItem }

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    label: 'main',
    items: [
      { label: 'dashboard', icon: LayoutDashboard, path: 'dashboard' },
      { label: 'members', icon: Users, path: 'members' },
      { label: 'memberships', icon: CreditCard, path: 'memberships' },
      { label: 'plans', icon: Package, path: 'plans' },
    ],
  },
  {
    label: 'operations',
    items: [
      { label: 'scan', icon: QrCode, path: 'attendance/scan' },
      { label: 'attendance', icon: CheckSquare, path: 'attendance' },
      { label: 'trainers', icon: UserCheck, path: 'trainers' },
      { label: 'classes', icon: Calendar, path: 'classes' },
      { label: 'inventory', icon: Box, path: 'inventory' },
    ],
    storeItem: { label: 'store', icon: ShoppingCart, path: 'store' },
  },
  {
    label: 'management',
    items: [
      { label: 'reports', icon: BarChart2, path: 'reports' },
      { label: 'marketing', icon: Megaphone, path: 'marketing' },
      { label: 'communications', icon: MessageSquare, path: 'communications' },
      { label: 'settings', icon: Settings, path: 'settings' },
      { label: 'support', icon: LifeBuoy, path: 'support' },
    ],
  },
]

interface GymSidebarProps {
  gymSlug: string
  gymName: string
  gymLogo?: string
  gymPlan?: string
  gymSubscriptionStatus?: string
  gymTrialEndsAt?: string
  gymDemoEnabled?: boolean
  hasBanner?: boolean
  userEmail: string
  userRole?: string
  storeEnabled?: boolean
}

function NavContent({
  gymSlug,
  gymName,
  gymLogo,
  gymPlan,
  userEmail,
  userRole,
  pathname,
  onClose,
  isPending,
  onLogout,
  storeEnabled,
  searchRef,
}: {
  gymSlug: string
  gymName: string
  gymLogo?: string
  gymPlan?: string
  userEmail: string
  userRole?: string
  pathname: string
  onClose?: () => void
  isPending: boolean
  onLogout: () => void
  storeEnabled?: boolean
  searchRef?: RefObject<HTMLInputElement | null>
}) {
  const { theme, toggle } = useTheme()
  const t = useT(shellMessages)
  const router = useRouter()
  const base = `/gym/${gymSlug}`

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    router.push(q ? `${base}/members?q=${encodeURIComponent(q)}` : `${base}/members`)
    onClose?.()
  }

  return (
    <div className="adm-night flex h-full flex-col bg-adm-night px-3.5 pb-4 pt-5 font-admin text-white">
      <div className="flex items-center justify-between gap-2 px-2 pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <GymMark name={gymName} logoUrl={gymLogo} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[17px] font-extrabold tracking-tight [font-stretch:112%]">{gymName}</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[#85857f]">
              {gymPlan ?? t.panelTagline}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label={t.closeMenu}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#a3a39d] hover:bg-[#1c1c1e] hover:text-white"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {userRole === 'SUPER_ADMIN' && (
        <Link
          href="/admin/dashboard"
          className="mx-0.5 mb-[18px] flex min-h-10 items-center gap-2 rounded-lg border border-[#2a2a2c] bg-[#141416] px-3 text-[13px] font-semibold text-adm-brand hover:border-[#3a3a3d]"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t.backToAdmin}
        </Link>
      )}

      <form role="search" onSubmit={handleSearch} data-tour="search" className="mx-0.5 mb-[18px]">
        <label className="flex min-h-10 items-center gap-2.5 rounded-lg border border-[#2a2a2c] bg-[#141416] px-3 text-[13px] text-[#a3a39d] focus-within:border-[#85857f]">
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">{t.searchMember}</span>
          <input
            ref={searchRef}
            name="q"
            type="search"
            autoComplete="off"
            placeholder={t.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-white placeholder:text-[#a3a39d] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {searchRef && (
            <kbd className="hidden rounded bg-[#232326] px-1.5 py-0.5 font-admin-mono text-[11px] text-[#a3a39d] lg:inline">⌘K</kbd>
          )}
        </label>
      </form>

      <nav aria-label={t.nav.main} className="flex flex-1 flex-col gap-[18px] overflow-y-auto">
        {BASE_NAV_GROUPS.map((group) => {
          const items = group.storeItem && storeEnabled
            ? [group.items[0], group.storeItem, ...group.items.slice(1)]
            : group.items
          return (
            <div key={group.label} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#85857f]">{t.nav[group.label]}</p>
              {items.map(({ label, icon: Icon, path }) => {
                const href = `${base}/${path}`
                // A nested item (e.g. attendance/scan) wins over its parent (attendance).
                const nestedMatch = items.some(o => o.path.startsWith(path + '/') && pathname.startsWith(`${base}/${o.path}`))
                const active = pathname === href || (pathname.startsWith(href + '/') && !nestedMatch)
                return (
                  <Link
                    key={path}
                    href={href}
                    onClick={onClose}
                    data-tour={`nav-${path}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                      active
                        ? 'bg-adm-brand font-bold text-adm-night'
                        : 'font-medium text-[#a3a39d] hover:bg-[#1c1c1e] hover:text-white',
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                    <span className="flex-1">{t.nav[label]}</span>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="mt-5 flex items-center gap-2.5 rounded-[10px] border border-[#232326] bg-[#141416] p-3">
        <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#2a2a2c] text-xs font-extrabold text-white">
          {initials(userEmail.split('@')[0].replace(/[._-]+/g, ' ')) || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{t.roles[userRole ?? ''] ?? t.myAccount}</p>
          <p className="truncate text-xs text-[#85857f]">{userEmail}</p>
        </div>
        <button
          type="button"
          data-tour="tour-button"
          onClick={() => { onClose?.(); window.dispatchEvent(new Event(TOUR_START_EVENT)) }}
          aria-label={t.tourOpen}
          title={t.tour}
          className="flex size-8 items-center justify-center rounded-lg text-[#a3a39d] hover:bg-[#232326] hover:text-white"
        >
          <Compass className="size-4" />
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? t.toLight : t.toDark}
          className="flex size-8 items-center justify-center rounded-lg text-[#a3a39d] hover:bg-[#232326] hover:text-white"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <button
          type="button"
          onClick={onLogout}
          disabled={isPending}
          aria-label={t.logout}
          title={isPending ? t.loggingOut : t.logout}
          className="flex size-8 items-center justify-center rounded-lg text-[#a3a39d] hover:bg-[#232326] hover:text-white disabled:opacity-40"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function GymSidebar({ gymSlug, gymName, gymLogo, gymPlan, hasBanner, userEmail, userRole, storeEnabled }: GymSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const searchRef = useRef<HTMLInputElement>(null)
  const t = useT(shellMessages)

  // ⌘K / Ctrl+K focuses the member search (opens the drawer on small screens).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      const input = searchRef.current
      if (input && input.offsetParent !== null) input.focus()
      else setMobileOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  function handleLogout() {
    startTransition(async () => {
      await logoutAction()
    })
  }

  const shared = { gymSlug, gymName, gymLogo, gymPlan, userEmail, userRole, pathname, isPending, onLogout: handleLogout, storeEnabled }

  return (
    <>
      <aside className="sticky top-0 hidden h-full w-[248px] shrink-0 lg:flex lg:flex-col">
        <NavContent {...shared} searchRef={searchRef} />
      </aside>

      <div
        className={cn(
          'adm-night fixed inset-x-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-adm-night px-4 font-admin lg:hidden',
          hasBanner ? 'top-8' : 'top-0',
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <GymMark name={gymName} logoUrl={gymLogo} />
          <span className="truncate text-sm font-extrabold text-white">{gymName}</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white/70 hover:text-white"
          aria-label={t.openMenu}
          aria-expanded={mobileOpen}
        >
          <Menu className="size-5" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 shadow-2xl">
            <NavContent {...shared} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
