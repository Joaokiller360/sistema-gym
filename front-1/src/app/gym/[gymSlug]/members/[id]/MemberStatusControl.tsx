'use client'

import { useState, useTransition } from 'react'
import { toggleMemberActiveAction } from './actions'

interface Props {
  memberId: string
  gymSlug: string
  isActive: boolean
}

export function MemberStatusControl({ memberId, gymSlug, isActive }: Props) {
  const [active, setActive] = useState(isActive)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Estado del miembro</p>
      <div className="flex gap-2">
        <StatusButton
          label="Activo"
          selected={active === true}
          disabled={isPending}
          onClick={() => handleSelect(true)}
          variant="teal"
        />
        <StatusButton
          label="Inactivo"
          selected={active === false}
          disabled={isPending}
          onClick={() => handleSelect(false)}
          variant="zinc"
        />
      </div>
      {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}
    </div>
  )
}

function StatusButton({
  label,
  selected,
  disabled,
  onClick,
  variant,
}: {
  label: string
  selected: boolean
  disabled: boolean
  onClick: () => void
  variant: 'teal' | 'red' | 'zinc'
}) {
  const STYLES = {
    teal: {
      active: 'bg-[#1fad9d] text-white border-[#1fad9d]',
      inactive: 'bg-white text-zinc-500 border-zinc-200 hover:border-[#1fad9d]/40 hover:text-[#1fad9d]',
    },
    red: {
      active: 'bg-[#ff0000] text-white border-[#ff0000]',
      inactive: 'bg-white text-zinc-500 border-zinc-200 hover:border-[#ff0000]/40 hover:text-[#ff0000]',
    },
    zinc: {
      active: 'bg-zinc-700 text-white border-zinc-700',
      inactive: 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-700',
    },
  }
  const style = STYLES[variant]

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-bold border transition-all disabled:opacity-50 ${
        selected ? style.active : style.inactive
      }`}
    >
      {label}
    </button>
  )
}
