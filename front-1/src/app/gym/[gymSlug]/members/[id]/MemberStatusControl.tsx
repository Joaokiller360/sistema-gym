'use client'

import { useState, useTransition } from 'react'
import { toggleMemberActiveAction } from './actions'
import { useT } from '@/i18n/client'
import { membersMessages } from '../messages'

interface Props {
  memberId: string
  gymSlug: string
  isActive: boolean
}

export function MemberStatusControl({ memberId, gymSlug, isActive }: Props) {
  const [active, setActive] = useState(isActive)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const t = useT(membersMessages).status

  function handleSelect(newVal: boolean) {
    if (newVal === active || isPending) return
    const prev = active
    setActive(newVal)
    setError(null)
    startTransition(async () => {
      const res = await toggleMemberActiveAction(gymSlug, memberId, newVal)
      if (res.error) {
        setActive(prev)
        setError(res.error)
      }
    })
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-adm-muted">{t.label}</p>
      <div role="group" aria-label={t.label} className="inline-flex gap-1 rounded-xl bg-adm-chip p-1">
        <StatusButton label={t.active} selected={active} disabled={isPending} onClick={() => handleSelect(true)} dot="bg-[#1fad9d]" />
        <StatusButton label={t.inactive} selected={!active} disabled={isPending} onClick={() => handleSelect(false)} dot="bg-zinc-400" />
      </div>
      {error && <p className="text-xs font-medium text-adm-bad-fg">{error}</p>}
    </div>
  )
}

function StatusButton({
  label,
  selected,
  disabled,
  onClick,
  dot,
}: {
  label: string
  selected: boolean
  disabled: boolean
  onClick: () => void
  dot: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-[9px] px-3.5 text-[13px] transition-all disabled:opacity-50 ${
        selected
          ? 'bg-adm-surface font-extrabold text-adm-ink shadow-[0_1px_3px_rgba(18,20,19,0.12)]'
          : 'font-semibold text-adm-muted hover:text-adm-ink'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${selected ? dot : 'bg-adm-line'}`} />
      {label}
    </button>
  )
}
