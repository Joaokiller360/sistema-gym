'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  SlidersHorizontal,
  LogOut,
  Dumbbell,
  CreditCard,
  TrendingUp,
  Menu,
  X,
  Moon,
  Sun,
  LifeBuoy,
  CalendarClock,
  Mail,
  MessageCircle,
  DatabaseBackup,
  type LucideIcon,
} from 'lucide-react'
import { cn, normalizeLogoUrl } from '@/lib/utils'
import { logoutAction } from '@/lib/logout'
import { useTheme } from '@/components/providers/ThemeProvider'

export interface AdminNavCounts {
  gyms?: number
  requests?: number
  tickets?: number
  crm?: number
}

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  count?: keyof AdminNavCounts
  countTone?: 'muted' | 'brand' | 'alert'
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Operación',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      { label: 'Gimnasios', href: '/admin/gyms', icon: Building2, count: 'gyms', countTone: 'muted' },
      { label: 'Solicitudes', href: '/admin/acceso', icon: CalendarClock, count: 'requests', countTone: 'brand' },
    ],
  },
  {
    group: 'Negocio',
    items: [
      { label: 'Ingresos', href: '/admin/income', icon: TrendingUp },
      { label: 'Planes', href: '/admin/plans', icon: CreditCard },
    ],
  },
  {
    group: 'Comunidad',
    items: [
      { label: 'CRM', href: '/admin/crm', icon: MessageCircle, count: 'crm', countTone: 'alert' },
      { label: 'Comunicaciones', href: '/admin/comunicaciones', icon: Mail },
      { label: 'Soporte', href: '/admin/support', icon: LifeBuoy, count: 'tickets', countTone: 'alert' },
    ],
  },
  {
    group: 'Plataforma',
    items: [
      { label: 'Configuración', href: '/admin/settings', icon: SlidersHorizontal },
      { label: 'Copias de seguridad', href: '/admin/backups', icon: DatabaseBackup },
    ],
  },
]

interface AdminSidebarProps {
  user: { email: string }
  saasName?: string
  logoUrl?: string | null
  counts?: AdminNavCounts
}

/** Platform logo, falling back to the dumbbell on the brand yellow. */
function BrandMark({ logoUrl, small = false }: { logoUrl?: string | null; small?: boolean }) {
  const src = normalizeLogoUrl(logoUrl)
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-adm-brand',
        small ? 'size-7 rounded-md' : 'size-9 rounded-[10px]',
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Dumbbell className={cn('text-adm-night', small ? 'size-3.5' : 'size-[18px]')} aria-hidden="true" />
      )}
    </div>
  )
}

function CountBadge({ value, tone, active }: { value: number; tone: NavItem['countTone']; active: boolean }) {
  if (tone === 'muted') {
    return <span className={cn('font-admin-mono text-xs', active ? 'text-adm-night' : 'text-[#85857f]')}>{value}</span>
  }
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold',
        active
          ? 'bg-adm-night text-adm-brand'
          : tone === 'brand'
            ? 'bg-adm-brand text-adm-night'
            : 'bg-[#e5484d] text-white',
      )}
    >
      {value}
    </span>
  )
}

function NavContent({
  user,
  pathname,
  onClose,
  isPending,
  onLogout,
  saasName,
  logoUrl,
  counts,
}: {
  user: { email: string }
  pathname: string
  onClose?: () => void
  isPending: boolean
  onLogout: () => void
  saasName: string
  logoUrl?: string | null
  counts: AdminNavCounts
}) {
  const { theme, toggle } = useTheme()
  const profileActive = pathname.startsWith('/admin/profile')

  return (
    <div className="adm-night flex h-full flex-col bg-adm-night px-3.5 pb-4 pt-5 text-white">
      <div className="flex items-center justify-between gap-2 px-2 pb-5">
        <div className="flex items-center gap-3">
          <BrandMark logoUrl={logoUrl} />
          <div className="leading-tight">
            <p className="text-[17px] font-extrabold tracking-tight [font-stretch:112%]">{saasName}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#85857f]">Super Admin</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="flex size-9 items-center justify-center rounded-lg text-[#a3a39d] hover:bg-[#1c1c1e] hover:text-white"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="Principal" className="flex flex-1 flex-col gap-[18px] overflow-y-auto">
        {NAV.map(({ group, items }) => (
          <div key={group} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#85857f]">{group}</p>
            {items.map(({ label, href, icon: Icon, count, countTone }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              const value = count ? counts[count] : undefined
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                    active
                      ? 'bg-adm-brand font-bold text-adm-night'
                      : 'font-medium text-[#a3a39d] hover:bg-[#1c1c1e] hover:text-white',
                  )}
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {value !== undefined && value > 0 && <CountBadge value={value} tone={countTone} active={active} />}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="mt-5 flex items-center gap-2.5 rounded-[10px] border border-[#232326] bg-[#141416] p-3">
        <div
          className={cn(
            'flex size-[34px] shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
            profileActive ? 'bg-adm-brand text-adm-night' : 'bg-[#2a2a2c] text-white',
          )}
        >
          SA
        </div>
        <Link
          href="/admin/profile"
          onClick={onClose}
          aria-current={profileActive ? 'page' : undefined}
          className="min-w-0 flex-1"
        >
          <p className="text-[13px] font-semibold">Mi perfil</p>
          <p className="truncate text-xs text-[#85857f]">{user.email}</p>
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="flex size-8 items-center justify-center rounded-lg text-[#a3a39d] hover:bg-[#232326] hover:text-white"
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <button
          type="button"
          onClick={onLogout}
          disabled={isPending}
          aria-label="Cerrar sesión"
          title={isPending ? 'Saliendo…' : 'Cerrar sesión'}
          className="flex size-8 items-center justify-center rounded-lg text-[#a3a39d] hover:bg-[#232326] hover:text-white disabled:opacity-40"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function AdminSidebar({ user, saasName = 'GymOS', logoUrl, counts = {} }: AdminSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

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

  const shared = { user, pathname, isPending, onLogout: handleLogout, saasName, logoUrl, counts }

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 lg:flex lg:flex-col">
        <NavContent {...shared} />
      </aside>

      <div className="adm-night fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-adm-night px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <BrandMark logoUrl={logoUrl} small />
          <span className="text-sm font-extrabold text-white">{saasName} Admin</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="flex size-10 items-center justify-center rounded-lg text-white/70 hover:text-white"
          aria-label="Abrir menú"
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
