'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import {
  LayoutDashboard,
  Building2,
  Settings,
  LogOut,
  Dumbbell,
  CreditCard,
  TrendingUp,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/lib/logout'

const NAV = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Gimnasios', href: '/admin/gyms', icon: Building2 },
  { label: 'Ingresos', href: '/admin/income', icon: TrendingUp },
  { label: 'Planes', href: '/admin/plans', icon: CreditCard },
  { label: 'Configuración', href: '/admin/settings', icon: Settings },
]

interface AdminSidebarProps {
  user: { email: string }
}

function NavContent({
  user,
  pathname,
  onClose,
  isPending,
  onLogout,
}: {
  user: { email: string }
  pathname: string
  onClose?: () => void
  isPending: boolean
  onLogout: () => void
}) {
  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fffb00] shrink-0">
            <Dumbbell className="h-4 w-4 text-black" />
          </div>
          <div className="leading-none">
            <p className="font-bold text-white">GymOs</p>
            <p className="text-xs text-white/40 mt-0.5">Super Admin</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/60 hover:text-white ml-2">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
          Navegación
        </p>
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
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
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-3 py-4 space-y-1">
        <div className="px-3 py-1.5">
          <p className="text-xs text-white/40 truncate">{user.email}</p>
        </div>
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

export function AdminSidebar({ user }: AdminSidebarProps) {
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
          user={user}
          pathname={pathname}
          isPending={isPending}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 h-14 bg-black flex items-center justify-between px-4 lg:hidden border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#fffb00]">
            <Dumbbell className="h-3.5 w-3.5 text-black" />
          </div>
          <span className="font-bold text-white text-sm">GymOS Admin</span>
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
              user={user}
              pathname={pathname}
              onClose={() => setMobileOpen(false)}
              isPending={isPending}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}
    </>
  )
}
