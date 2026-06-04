'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
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
  Dumbbell,
  ChevronLeft,
  Moon,
  Sun,
  ShoppingCart,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/lib/logout'
import { useTheme } from '@/components/providers/ThemeProvider'

type NavItem = { label: string; icon: LucideIcon; path: string }
type NavGroup = { label: string; items: NavItem[]; storeItem?: NavItem }

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Principal',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
      { label: 'Miembros', icon: Users, path: 'members' },
      { label: 'Membresías', icon: CreditCard, path: 'memberships' },
      { label: 'Planes', icon: Package, path: 'plans' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { label: 'Asistencia', icon: CheckSquare, path: 'attendance' },
      { label: 'Entrenadores', icon: UserCheck, path: 'trainers' },
      { label: 'Clases', icon: Calendar, path: 'classes' },
      { label: 'Inventario', icon: Box, path: 'inventory' },
    ],
    storeItem: { label: 'Tienda', icon: ShoppingCart, path: 'store' },
  },
  {
    label: 'Gestión',
    items: [
      { label: 'Reportes', icon: BarChart2, path: 'reports' },
      { label: 'Marketing', icon: Megaphone, path: 'marketing' },
      { label: 'Comunicaciones', icon: MessageSquare, path: 'communications' },
      { label: 'Configuración', icon: Settings, path: 'settings' },
      { label: 'Soporte', icon: LifeBuoy, path: 'support' },
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
  isTrial,
  trialDaysLeft,
  gymDemoEnabled,
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
  isTrial?: boolean
  trialDaysLeft?: number | null
  gymDemoEnabled?: boolean
}) {
  const base = `/gym/${gymSlug}`
  const emailInitial = userEmail?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex flex-col h-full bg-[#080808] border-r border-white/[0.06]">
      {/* Trial banner */}
      {isTrial && (
        <div className="h-8 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center gap-1.5 px-4 shrink-0">
          <span className="text-xs font-semibold text-white/90 tracking-wide">Prueba gratuita</span>
          {trialDaysLeft !== null && trialDaysLeft !== undefined && (
            <>
              <span className="text-white/50 text-xs">·</span>
              <span className="text-xs font-bold text-white">
                {trialDaysLeft === 0 ? 'último día' : `${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}`}
              </span>
            </>
          )}
        </div>
      )}
      {/* Demo banner */}
      {!isTrial && gymDemoEnabled && (
        <div className="h-8 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center gap-1.5 px-4 shrink-0">
          <span className="text-xs font-semibold text-white/90 tracking-wide">Demo habilitada</span>
          <span className="text-white/50 text-xs">·</span>
          <span className="text-xs text-white/75">Datos de ejemplo activos</span>
        </div>
      )}
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'flex items-center justify-center w-9 h-9 rounded-xl shrink-0 overflow-hidden',
              gymLogo ? 'bg-white/5' : 'bg-[#fffb00] shadow-[0_0_16px_rgba(255,251,0,0.28)]',
            )}>
              {gymLogo
                ? <img src={gymLogo} alt={gymName} className="w-full h-full object-cover" />
                : <Dumbbell className="h-4 w-4 text-black" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm tracking-tight truncate leading-tight">{gymName}</p>
              {gymPlan ? (
                <span className="inline-flex items-center mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#fffb00]/10 text-[#fffb00] ring-1 ring-[#fffb00]/25">
                  {gymPlan}
                </span>
              ) : (
                <p className="text-[11px] text-white/30 mt-0.5 tracking-wide">Panel de gestión</p>
              )}
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all shrink-0 ml-2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Super admin back button */}
      {userRole === 'SUPER_ADMIN' && (
        <div className="px-3 pt-3">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#fffb00] hover:bg-white/5 transition-all"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Volver al admin
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 scrollbar-thin">
        {BASE_NAV_GROUPS.map((group) => {
          const items = group.storeItem && storeEnabled
            ? [group.items[0], group.storeItem, ...group.items.slice(1)]
            : group.items
          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map(({ label, icon: Icon, path }) => {
                  const href = `${base}/${path}`
                  const active = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link
                      key={path}
                      href={href}
                      onClick={onClose}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                        active
                          ? 'bg-[#fffb00] text-black shadow-[0_2px_14px_rgba(255,251,0,0.22)] font-semibold'
                          : 'text-white/50 hover:bg-white/[0.07] hover:text-white/90',
                      )}
                    >
                      <Icon className={cn(
                        'h-4 w-4 shrink-0 transition-colors duration-150',
                        active ? 'text-black' : 'text-white/30 group-hover:text-white/70',
                      )} />
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-2.5 py-3 space-y-0.5">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-white/10 ring-1 ring-white/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-white/50">{emailInitial}</span>
          </div>
          <p className="text-[11px] text-white/30 truncate">{userEmail}</p>
        </div>
        <ThemeToggleButton />
        <button
          onClick={onLogout}
          disabled={isPending}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-white/40 hover:bg-white/[0.07] hover:text-white/80 transition-all duration-150 disabled:opacity-30"
        >
          <LogOut className="h-4 w-4 shrink-0 text-white/25 group-hover:text-white/60 transition-colors duration-150" />
          {isPending ? 'Saliendo…' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  )
}

function ThemeToggleButton() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-white/40 hover:bg-white/[0.07] hover:text-white/80 transition-all duration-150"
    >
      {theme === 'dark'
        ? <Sun className="h-4 w-4 shrink-0 text-white/25 group-hover:text-white/60 transition-colors duration-150" />
        : <Moon className="h-4 w-4 shrink-0 text-white/25 group-hover:text-white/60 transition-colors duration-150" />}
      {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    </button>
  )
}

export function GymSidebar({ gymSlug, gymName, gymLogo, gymPlan, gymSubscriptionStatus, gymTrialEndsAt, gymDemoEnabled, userEmail, userRole, storeEnabled }: GymSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutAction()
    })
  }

  const isTrial = gymSubscriptionStatus === 'TRIAL'
  const trialDaysLeft = isTrial && gymTrialEndsAt
    ? Math.max(0, Math.ceil((new Date(gymTrialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col shrink-0 h-screen sticky top-0">
        <NavContent
          gymSlug={gymSlug}
          gymName={gymName}
          gymLogo={gymLogo}
          gymPlan={gymPlan}
          userEmail={userEmail}
          userRole={userRole}
          pathname={pathname}
          isPending={isPending}
          onLogout={handleLogout}
          storeEnabled={storeEnabled}
          isTrial={isTrial}
          trialDaysLeft={trialDaysLeft}
          gymDemoEnabled={gymDemoEnabled}
        />
      </aside>

      {/* Mobile header (banner + top bar) */}
      <div className="fixed top-0 left-0 right-0 z-40 lg:hidden">
        {/* Trial banner */}
        {isTrial && (
          <div className="h-8 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center gap-1.5 px-4">
            <span className="text-xs font-semibold text-white/90 tracking-wide">
              Prueba gratuita
            </span>
            {trialDaysLeft !== null && (
              <>
                <span className="text-white/50 text-xs">·</span>
                <span className="text-xs font-bold text-white">
                  {trialDaysLeft === 0 ? 'último día' : `${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}`}
                </span>
              </>
            )}
          </div>
        )}
        {/* Demo banner */}
        {!isTrial && gymDemoEnabled && (
          <div className="h-8 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center gap-1.5 px-4">
            <span className="text-xs font-semibold text-white/90 tracking-wide">Demo habilitada</span>
            <span className="text-white/50 text-xs">·</span>
            <span className="text-xs text-white/75">Datos de ejemplo activos</span>
          </div>
        )}
        {/* Top bar */}
        <div className="h-14 bg-black/85 backdrop-blur-md flex items-center justify-between px-4 border-b border-white/8 shadow-lg shadow-black/20">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden shrink-0',
              gymLogo ? 'bg-white/5' : 'bg-[#fffb00] shadow-[0_0_12px_rgba(255,251,0,0.35)]',
            )}>
              {gymLogo
                ? <img src={gymLogo} alt={gymName} className="w-full h-full object-cover" />
                : <Dumbbell className="h-4 w-4 text-black" />}
            </div>
            <span className="font-semibold text-white text-sm tracking-tight truncate max-w-[160px]">
              {gymName}
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white/60 hover:text-white hover:bg-white/10 active:bg-white/15 transition-all duration-150"
            aria-label="Abrir menú"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 shadow-2xl">
            <NavContent
              gymSlug={gymSlug}
              gymName={gymName}
              gymLogo={gymLogo}
              gymPlan={gymPlan}
              userEmail={userEmail}
              userRole={userRole}
              pathname={pathname}
              onClose={() => setMobileOpen(false)}
              isPending={isPending}
              onLogout={handleLogout}
              storeEnabled={storeEnabled}
            />
          </div>
        </div>
      )}
    </>
  )
}
