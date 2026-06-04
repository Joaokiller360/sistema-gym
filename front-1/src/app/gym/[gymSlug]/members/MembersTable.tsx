'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { UserCircle2, ChevronRight } from 'lucide-react'
import { Member } from '@/types'
import { toggleMemberActiveAction } from './[id]/actions'

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function MembersTable({
  members,
  gymSlug,
  paramsString,
}: {
  members: Member[]
  gymSlug: string
  paramsString: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function toggleActive(id: string, current: boolean) {
    startTransition(async () => {
      await toggleMemberActiveAction(gymSlug, id, !current)
      router.refresh()
    })
  }

  function openMember(id: string) {
    const params = new URLSearchParams(paramsString)
    params.set('member', id)
    router.push(`?${params.toString()}`)
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-sm text-muted-foreground">
        <UserCircle2 className="h-12 w-12 mb-3 opacity-20" />
        No se encontraron miembros.
      </div>
    )
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {members.map(m => (
          <div
            key={m.id}
            onClick={() => openMember(m.id)}
            className="w-full flex items-center gap-3 bg-white rounded-2xl border border-zinc-200 px-4 py-3.5 hover:border-[#1fad9d] transition-colors active:scale-[0.99] cursor-pointer"
          >
            <div className="h-10 w-10 rounded-full bg-[#1fad9d]/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[#1fad9d]">{initials(m.firstName, m.lastName)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{m.firstName} {m.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isPending}
                onClick={(e) => { e.stopPropagation(); toggleActive(m.id, m.isActive) }}
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold transition-all disabled:opacity-50 ${
                  m.isActive
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                {m.isActive ? 'Activo' : 'Inactivo'}
              </button>
              <ChevronRight className="h-4 w-4 text-zinc-300" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block rounded-2xl border border-zinc-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500">Miembro</th>
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden md:table-cell">Teléfono</th>
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500">Estado</th>
              <th className="text-left px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-zinc-500 hidden lg:table-cell">Desde</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {members.map(m => (
              <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#1fad9d]/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[#1fad9d]">{initials(m.firstName, m.lastName)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate transition-colors">{m.firstName} {m.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-muted-foreground hidden md:table-cell">{m.phone ?? '—'}</td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={(e) => { e.stopPropagation(); toggleActive(m.id, m.isActive) }}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold transition-all disabled:opacity-50 ${
                      m.isActive
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-600'
                        : 'bg-zinc-100 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    {m.isActive ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-5 py-4 text-muted-foreground hidden lg:table-cell">{formatDate(m.createdAt)}</td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => openMember(m.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1fad9d] hover:text-[#0e7a70] transition-colors"
                  >
                    Ver perfil
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
