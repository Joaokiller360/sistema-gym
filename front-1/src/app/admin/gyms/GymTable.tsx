'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Building2, ChevronRight } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Gym } from '@/types'
import { toggleGymActiveAction } from './actions'

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function GymTable({ gyms }: { gyms: Gym[] }) {
  const [, startTransition] = useTransition()

  function handleToggle(gymId: string, active: boolean) {
    startTransition(async () => {
      await toggleGymActiveAction(gymId, active)
    })
  }

  if (gyms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-sm text-muted-foreground">
        <Building2 className="h-12 w-12 mb-3 opacity-20" />
        No se encontraron gimnasios.
      </div>
    )
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {gyms.map(gym => (
          <div key={gym.id} className="bg-white rounded-2xl border border-zinc-200 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
                {gym.logoUrl
                  ? <img src={gym.logoUrl} alt={gym.name} className="h-full w-full object-cover" />
                  : <span className="text-sm font-black text-black">{initials(gym.name)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{gym.name}</p>
                <p className="text-xs text-muted-foreground">{gym.slug}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Switch
                  checked={gym.isActive}
                  onCheckedChange={v => handleToggle(gym.id, v)}
                  aria-label={gym.isActive ? 'Deshabilitar' : 'Habilitar'}
                />
                <Link href={`/admin/gyms/${gym.id}`} className="text-zinc-400 hover:text-black">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block rounded-2xl border border-zinc-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500">Gimnasio</th>
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden md:table-cell">Dueño</th>
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500">Estado</th>
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Creado</th>
              <th className="text-center px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500">Activo</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {gyms.map(gym => (
              <tr key={gym.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
                      {gym.logoUrl
                        ? <img src={gym.logoUrl} alt={gym.name} className="h-full w-full object-cover" />
                        : <span className="text-xs font-black text-black">{initials(gym.name)}</span>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{gym.name}</p>
                      <p className="text-xs text-muted-foreground">{gym.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 hidden md:table-cell">
                  {gym.owner
                    ? <div>
                        <p className="font-medium text-sm">{gym.owner.name}</p>
                        <p className="text-xs text-zinc-400">{gym.owner.email}</p>
                      </div>
                    : <span className="text-zinc-400">—</span>
                  }
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={gym.isActive ? 'active' : 'inactive'} />
                </td>
                <td className="px-5 py-4 text-muted-foreground hidden lg:table-cell">{formatDate(gym.createdAt)}</td>
                <td className="px-5 py-4 text-center">
                  <Switch
                    checked={gym.isActive}
                    onCheckedChange={v => handleToggle(gym.id, v)}
                    aria-label={gym.isActive ? 'Deshabilitar' : 'Habilitar'}
                  />
                </td>
                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/admin/gyms/${gym.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1fad9d] hover:text-[#0e7a70] transition-colors"
                  >
                    Ver
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
