import type { Member, MembershipStatus } from '@/types'

export type MemberRow = Member & {
  memberships?: Array<{
    status: MembershipStatus
    endDate: string
    visitsTotal: number | null
    visitsUsed: number
    plan: { id: string; name: string; durationDays: number; visitLimit: number | null }
  }>
  attendances?: Array<{ checkIn: string }>
}

export type StatusKey = 'activo' | 'atencion' | 'vencido' | 'sinplan' | 'inactivo'

export const STATUS_FILTERS: { key: StatusKey | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'activo', label: 'Activos' },
  { key: 'atencion', label: 'Por vencer' },
  { key: 'vencido', label: 'Vencidos' },
  { key: 'sinplan', label: 'Sin plan' },
  { key: 'inactivo', label: 'Inactivos' },
]

// Classes covered by the dark-mode overrides in globals.css
const TONES = {
  ok: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  neutral: 'bg-zinc-100 text-zinc-600',
} as const

const BARS = { ok: 'bg-[#1fad9d]', warn: 'bg-amber-500', bad: 'bg-red-600', info: 'bg-blue-500', neutral: 'bg-zinc-300' } as const

export interface MemberView {
  key: StatusKey
  label: string
  badgeClass: string
  barClass: string
  planName: string
  planKind: string
  remainingLabel: string
  /** 0–1 share of the plan still left */
  pct: number
  bigNumber: string
  bigCaption: string
  planNote: string
  lastVisit: string
  lastVisitAt: string | null
}

const DAY = 86_400_000
/** Time plans with this many days or fewer, and visit plans with this many visits or fewer, need attention */
const SOON_DAYS = 3
const SOON_VISITS = 2

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export function fmtLastVisit(iso: string | null, now = new Date()) {
  if (!iso) return 'Nunca'
  const d = new Date(iso)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  if (d.getTime() >= startOfToday) return `Hoy ${time}`
  const days = Math.ceil((startOfToday - d.getTime()) / DAY)
  if (days <= 1) return 'Ayer'
  if (days < 30) return `Hace ${days} días`
  const months = Math.round(days / 30)
  return months <= 1 ? 'Hace 1 mes' : `Hace ${months} meses`
}

export function memberView(m: MemberRow, now = new Date()): MemberView {
  const lastVisitAt = m.attendances?.[0]?.checkIn ?? null
  const base = { lastVisit: fmtLastVisit(lastVisitAt, now), lastVisitAt }
  const view = (key: StatusKey, label: string, tone: keyof typeof TONES, rest: Omit<MemberView, 'key' | 'label' | 'badgeClass' | 'barClass' | 'lastVisit' | 'lastVisitAt'>): MemberView =>
    ({ key, label, badgeClass: TONES[tone], barClass: BARS[tone], ...rest, ...base })

  const list = m.memberships ?? []
  // The membership that defines today's access: a current ACTIVE/FROZEN one, else the latest of any status
  const current = list.find(x => (x.status === 'ACTIVE' || x.status === 'FROZEN') && new Date(x.endDate) >= now) ?? list[0]

  if (!m.isActive) {
    return view('inactivo', 'Inactivo', 'neutral', {
      planName: current?.plan.name ?? 'Sin plan', planKind: '—', remainingLabel: '—', pct: 0,
      bigNumber: '—', bigCaption: 'socio inactivo', planNote: 'Reactivá al socio para poder registrar su entrada.',
    })
  }
  if (!current) {
    return view('sinplan', 'Sin plan', 'neutral', {
      planName: 'Sin plan', planKind: '—', remainingLabel: '—', pct: 0,
      bigNumber: '—', bigCaption: 'sin plan asignado', planNote: 'Asigná un plan para que pueda entrar.',
    })
  }

  const end = fmtDay(current.endDate)
  const daysLeft = Math.max(0, Math.ceil((new Date(current.endDate).getTime() - now.getTime()) / DAY))
  const isVisit = current.visitsTotal != null
  const planKind = isVisit ? `${current.visitsTotal} días · vence ${end}` : `Por tiempo · vence ${end}`
  const ended = current.status === 'EXPIRED' || current.status === 'CANCELLED' || current.status === 'SUSPENDED' || daysLeft === 0

  if (ended) {
    const usedUp = isVisit && current.visitsUsed >= current.visitsTotal!
    const label = current.status === 'CANCELLED' ? 'Cancelado' : current.status === 'SUSPENDED' ? 'Suspendido' : 'Vencido'
    return view('vencido', label, 'bad', {
      planName: current.plan.name, planKind,
      remainingLabel: usedUp ? 'Sin días' : label, pct: 0,
      bigNumber: '0',
      bigCaption: usedUp ? `de ${current.visitsTotal} días de entreno` : 'días hasta el vencimiento',
      planNote: usedUp
        ? 'Usó todos sus días. Renová el plan para habilitar la entrada.'
        : `El plan terminó el ${end}. Registrá un pago para renovarlo.`,
    })
  }

  if (current.status === 'FROZEN') {
    return view('activo', 'Congelado', 'info', {
      planName: current.plan.name, planKind, remainingLabel: 'Congelado', pct: 1,
      bigNumber: String(daysLeft), bigCaption: 'días al descongelar',
      planNote: 'Plan congelado: los días no corren hasta que se descongele.',
    })
  }

  if (isVisit) {
    const total = current.visitsTotal!
    const left = Math.max(0, total - current.visitsUsed)
    const soon = left <= SOON_VISITS || daysLeft <= SOON_DAYS
    return view(soon ? 'atencion' : 'activo', soon ? 'Por vencer' : 'Activo', soon ? 'warn' : 'ok', {
      planName: current.plan.name, planKind,
      remainingLabel: `${left} de ${total} días`, pct: left / total,
      bigNumber: String(left), bigCaption: `de ${total} días de entreno restantes`,
      planNote: `${current.visitsUsed} usados · cada día que entrena descuenta uno · vence ${end}`,
    })
  }

  const period = Math.max(1, current.plan.durationDays)
  const soon = daysLeft <= SOON_DAYS
  return view(soon ? 'atencion' : 'activo', soon ? 'Por vencer' : 'Activo', soon ? 'warn' : 'ok', {
    planName: current.plan.name, planKind,
    remainingLabel: `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`, pct: Math.min(1, daysLeft / period),
    bigNumber: String(daysLeft), bigCaption: daysLeft === 1 ? 'día hasta el vencimiento' : 'días hasta el vencimiento',
    planNote: `Acceso libre hasta el ${end}.`,
  })
}
