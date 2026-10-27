'use client'

import { useState, useTransition } from 'react'
import { Users } from 'lucide-react'
import { toast } from 'sonner'
import type { MembershipWithRelations } from '@/types'
import { addCompanionAction } from './actions'
import { CompanionPicker, type CompanionCandidate } from './CompanionPicker'
import { useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'
import { membersMessages } from '../messages'

interface Props {
  gymSlug: string
  membership: MembershipWithRelations
  candidates: CompanionCandidate[]
  busyIds?: Set<string>
}

export function SharedPlanBlock({ gymSlug, membership, candidates, busyIds }: Props) {
  const [picked, setPicked] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const t = useT(membersMessages).shared
  const statusLabel = useT(commonMessages).status

  const max = membership.plan?.maxMembers ?? 1
  const mates = membership.group ?? []
  const holding = mates.filter(m => m.status !== 'CANCELLED' && m.status !== 'EXPIRED')
  const free = Math.max(0, max - 1 - holding.length)

  function add() {
    const companionId = picked[0]
    if (!companionId) return
    startTransition(async () => {
      const res = await addCompanionAction(gymSlug, membership.id, membership.memberId, companionId)
      if (res.error) { toast.error(res.error); return }
      toast.success(t.added)
      setPicked([])
    })
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-adm-line bg-adm-surface p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-adm-muted">
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        {t.heading(1 + holding.length, max)}
      </p>

      {mates.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {mates.map(m => (
            <li key={m.id}>
              <a
                href={`?member=${m.memberId}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-adm-chip px-3 text-xs font-semibold text-adm-ink hover:bg-adm-line"
              >
                {m.member.firstName} {m.member.lastName}
                {m.status !== 'ACTIVE' && <span className="text-adm-muted">· {statusLabel[m.status] ?? m.status}</span>}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-adm-muted">{t.none}</p>
      )}

      {free > 0 && (
        <div className="space-y-2">
          <CompanionPicker
            candidates={candidates}
            excludeIds={[membership.memberId, ...mates.map(m => m.memberId)]}
            busyIds={busyIds}
            max={1}
            value={picked}
            onChange={setPicked}
            disabled={isPending}
          />
          {picked.length > 0 && (
            <button
              type="button"
              onClick={add}
              disabled={isPending}
              className="h-10 rounded-xl bg-[#1fad9d] px-4 text-sm font-bold text-white transition-colors hover:bg-[#0e7a70] disabled:opacity-50"
            >
              {isPending ? t.adding : t.add}
            </button>
          )}
          <p className="text-xs text-adm-muted">
            {t.free(free)} {t.sameDates}
          </p>
        </div>
      )}
    </div>
  )
}
