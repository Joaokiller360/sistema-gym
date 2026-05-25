'use client'

import { useState } from 'react'
import { MembershipWithRelations, Plan } from '@/types'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { MembershipModal } from './MembershipModal'
import { Settings2 } from 'lucide-react'

interface Props {
  memberships: MembershipWithRelations[]
  plans: Plan[]
  gymSlug: string
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function MembershipsClient({ memberships, plans, gymSlug }: Props) {
  const [selected, setSelected] = useState<MembershipWithRelations | null>(null)

  if (memberships.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed py-20">
        <p className="text-muted-foreground text-sm">Sin membresías en esta categoría</p>
      </div>
    )
  }

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()

  return (
    <>
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Miembro</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                Plan
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                Inicio
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                Vence
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {memberships.map(m => {
              const daysLeft = Math.ceil(
                (new Date(m.endDate).getTime() - now) / 86_400_000,
              )
              const nearExpiry = m.status === 'ACTIVE' && daysLeft <= 7 && daysLeft > 0
              const overdue = m.status === 'ACTIVE' && daysLeft <= 0

              return (
                <tr
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1fad9d]/10 text-[#0e7a70] text-xs font-bold select-none">
                        {m.member.firstName[0]}{m.member.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {m.member.firstName} {m.member.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate hidden sm:block">
                          {m.member.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {m.plan.name}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {fmt(m.startDate)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span
                      className={
                        nearExpiry
                          ? 'font-semibold text-amber-600'
                          : overdue
                            ? 'text-red-500'
                            : 'text-muted-foreground'
                      }
                    >
                      {fmt(m.endDate)}
                      {nearExpiry && (
                        <span className="ml-1.5 text-xs opacity-70">({daysLeft}d)</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setSelected(m) }}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label="Gestionar membresía"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <MembershipModal
        membership={selected}
        plans={plans}
        gymSlug={gymSlug}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
