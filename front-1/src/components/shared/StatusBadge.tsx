import { MembershipStatus } from '@/types'

export type StatusKey = MembershipStatus | 'active' | 'inactive'

const CONFIG: Record<StatusKey, { label: string; className: string }> = {
  ACTIVE:    { label: 'Activo',     className: 'bg-[#1fad9d]/15 text-[#0e7a70] border border-[#1fad9d]/30' },
  EXPIRED:   { label: 'Vencido',    className: 'bg-[#ff0000]/10 text-[#cc0000] border border-[#ff0000]/20' },
  SUSPENDED: { label: 'Suspendido', className: 'bg-[#fffb00]/40 text-black border border-[#fffb00]' },
  FROZEN:    { label: 'Congelado',  className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  CANCELLED: { label: 'Cancelado',  className: 'bg-zinc-100 text-zinc-500 border border-zinc-200' },
  active:    { label: 'Activo',     className: 'bg-[#1fad9d]/15 text-[#0e7a70] border border-[#1fad9d]/30' },
  inactive:  { label: 'Inactivo',   className: 'bg-zinc-100 text-zinc-500 border border-zinc-200' },
}

export function StatusBadge({ status }: { status: StatusKey }) {
  const { label, className } = CONFIG[status] ?? { label: status, className: 'bg-zinc-100 text-zinc-500' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}
