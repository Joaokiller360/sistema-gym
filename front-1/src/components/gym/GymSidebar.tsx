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
    ],
  },
]

interface GymSidebarProps {
  gymSlug: string
  gymName: string
  gymLogo?: string
  gymPlan?: string
  userEmail: string
  userRole?: string
  storeEnabled?: boolean
}

function NavContent({
  gymSlug,
  gymName,
  gymPlan,
  userEmail,
  userRole,
  pathname,
  onClose,
  isPending,
  onLogout,
  storeEnabled,
}: {
  gymSlug: string
  gymName: string
  gymPlan?: string
  userEmail: string
  userRole?: string
  pathname: string
  onClose?: () => void
  isPending: boolean
  onLogout: () => void
  storeEnabled?: boolean
}) {
  const base = `/gym/${gymSlug}`

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fffb00] shrink-0">
            <Dumbbell className="h-4 w-4 text-black" />
          </div>
          <div className="leading-none min-w-0">
            <p className="font-bold text-white text-sm truncate">{gymName}</p>
            {gymPlan ? (
              <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[#fffb00]/20 text-[#fffb00]">
                {gymPlan}
              </span>
            ) : (
              <p className="text-xs text-white/40 mt-0.5">Panel de gestión</p>
            )}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/60 hover:text-white ml-2 shrink-0">
            <X className="h-5 w-5" />
          </button>
        )}
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
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {BASE_NAV_GROUPS.map((group) => {
          const items = group.storeItem && storeEnabled
            ? [group.items[0], group.storeItem, ...group.items.slice(1)]
            : group.items
          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30">
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
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                        active
                          ? 'bg-[#fffb00] text-black'
                          : 'text-white/60 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
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
      <div className="border-t border-white/10 px-3 py-4 space-y-1">
        <div className="px-3 py-1.5">
          <p className="text-xs text-white/40 truncate">{userEmail}</p>
        </div>
        <ThemeToggleButton />
        <button
          onClick={onLogout}
          disabled={isPending}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white transition-all disabled:opacity-40"
        >
          <LogOut className="h-4 w-4 shrink-0" />
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
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white transition-all"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    </button>
  )
}

export function GymSidebar({ gymSlug, gymName, gymPlan, userEmail, userRole, storeEnabled }: GymSidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await logoutAction()
    })
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col shrink-0 h-screen sticky top-0">
        <NavContent
          gymSlug={gymSlug}
          gymName={gymName}
          gymPlan={gymPlan}
          userEmail={userEmail}
          userRole={userRole}
          pathname={pathname}
          isPending={isPending}
          onLogout={handleLogout}
          storeEnabled={storeEnabled}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-14 bg-black flex items-center justify-between px-4 lg:hidden border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#fffb00]">
            <Dumbbell className="h-3.5 w-3.5 text-black" />
          </div>
          <span className="font-bold text-white text-sm truncate max-w-[160px]">{gymName}</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-white/70 hover:text-white p-1"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
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
