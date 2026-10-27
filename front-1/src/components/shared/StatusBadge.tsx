'use client'

import { MembershipStatus } from '@/types'
import { useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'

export type StatusKey = MembershipStatus | 'active' | 'inactive'

const CLASS: Record<StatusKey, string> = {
  ACTIVE:    'bg-[#1fad9d]/15 text-[#0e7a70] border border-[#1fad9d]/30',
  EXPIRED:   'bg-[#ff0000]/10 text-[#cc0000] border border-[#ff0000]/20',
  SUSPENDED: 'bg-[#fffb00]/40 text-black border border-[#fffb00]',
  FROZEN:    'bg-blue-50 text-blue-700 border border-blue-200',
  CANCELLED: 'bg-zinc-100 text-zinc-500 border border-zinc-200',
  active:    'bg-[#1fad9d]/15 text-[#0e7a70] border border-[#1fad9d]/30',
  inactive:  'bg-zinc-100 text-zinc-500 border border-zinc-200',
}

export function StatusBadge({ status }: { status: StatusKey }) {
  const label = useT(commonMessages).status[status] ?? status
  const className = CLASS[status] ?? 'bg-zinc-100 text-zinc-500'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}
