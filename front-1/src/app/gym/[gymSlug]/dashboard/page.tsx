'use server'

import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { Users, TrendingUp, CheckSquare, Calendar, UserPlus, ClipboardList, Dumbbell, BarChart2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { KpiCard } from '@/components/shared/KpiCard'
import { Member, Plan, Class, Gym } from '@/types'
import { NewMemberModal } from '../members/NewMemberModal'
import { AdvancedReportsSection, type AdvancedReport } from './AdvancedReportsSection'
import { QuickCheckInModal } from './QuickCheckInModal'

interface MembersResponse { data: Member[]; total: number }
interface FinancialReport { totalRevenue: number; currency: string }
interface AttendanceWithMember {
  id: string
  checkIn: string
  checkOut: string | null
  memberId: string
  member?: { id: string; firstName: string; lastName: string } | null
}

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ new?: string; modal?: string }>
}

function gymDayBoundsISO(dateStr: string, tz: string): { start: string; end: string } {
  const [year, month, day] = dateStr.split('-').map(Number)
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(noonUTC)
  const g = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0')
  const localNoonUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'))
  const offsetMs = noonUTC.getTime() - localNoonUTC
  return {
    start: new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + offsetMs).toISOString(),
    end:   new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) + offsetMs).toISOString(),
  }
}

export default async function GymDashboardPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { new: newParam, modal } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const session = await verifyToken(token)
  const isSuperAdmin = session?.role === 'SUPER_ADMIN'

  const gymHeader = { headers: { 'x-gym-slug': gymSlug } }

  // Fetch gym info + timezone
  const [gym, gymStatus] = await Promise.all([
    apiFetch<Gym>(`/gyms/${gymSlug}`, token),
    apiFetch<{ timezone: string; localTime: string; isOpen: boolean }>(`/gyms/${gymSlug}/status`, token),
  ])

  const tz = gymStatus?.timezone ?? 'UTC'
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz })
  const monthStr = todayStr.slice(0, 7) + '-01' // "YYYY-MM-01"

  // 3-day expiry window in gym timezone
  const in3DaysStr = new Date(now.getTime() + 3 * 86400000)
    .toLocaleDateString('en-CA', { timeZone: tz })

  const gymIdParam = isSuperAdmin && gym ? `&gymId=${gym.id}` : ''
  const advancedEnabled = gym?.advancedReportsEnabled ?? false

  const [membersRaw, attendanceRaw, classes, financial, advancedReport, expiringRaw] = await Promise.all([
    apiFetch<MembersResponse | Member[]>(`/members?status=active&limit=5`, token, gymHeader),
    apiFetch<AttendanceWithMember[]>(`/attendance?startDate=${gymDayBoundsISO(todayStr, tz).start}&endDate=${gymDayBoundsISO(todayStr, tz).end}`, token, gymHeader),
    apiFetch<Class[]>(`/classes`, token, gymHeader),
    apiFetch<FinancialReport>(`/reports/financial?startDate=${monthStr}${gymIdParam}`, token, gymHeader),
    advancedEnabled
      ? apiFetch<AdvancedReport>(`/reports/advanced?startDate=${monthStr}&endDate=${todayStr}`, token, gymHeader)
      : Promise.resolve(null),
    apiFetch<any[]>(`/memberships?status=ACTIVE&endsAfter=${todayStr}&endsBefore=${in3DaysStr}`, token, gymHeader),
  ])

  const activeMembers = membersRaw
    ? Array.isArray(membersRaw) ? membersRaw.length : membersRaw.total
    : 0
  const todayAttendance = attendanceRaw?.length ?? 0
  const activeClasses = classes?.filter(c => c.isActive).length ?? 0
  const monthRevenue = financial?.totalRevenue ?? 0
  const currency = financial?.currency ?? 'USD'

  const recentMembers: Member[] = membersRaw
    ? (Array.isArray(membersRaw) ? membersRaw : membersRaw.data).slice(0, 5)
    : []

  const expiringCount = Array.isArray(expiringRaw) ? expiringRaw.length : 0

  const QUICK_LINKS = [
    { href: `?new=member`, label: 'Nuevo miembro', icon: UserPlus, color: 'bg-[#1fad9d]/10 text-[#1fad9d] hover:bg-[#1fad9d]/20' },
    { href: `?modal=checkin`, label: 'Asistencia', icon: CheckSquare, color: 'bg-[#fffb00]/30 text-black hover:bg-[#fffb00]/50' },
    { href: `trainers`, label: 'Entrenadores', icon: Dumbbell, color: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' },
    { href: `plans`, label: 'Planes', icon: ClipboardList, color: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' },
    { href: `members`, label: 'Miembros', icon: Users, color: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' },
    { href: `reports`, label: 'Reportes', icon: BarChart2, color: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1 capitalize">
            {now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })}
          </p>
        </div>
      </div>

      {/* Quick access */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">Accesos rápidos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_LINKS.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-2 rounded-2xl px-3 py-4 text-center text-xs font-semibold transition-all ${color}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Miembros activos" value={activeMembers} icon={Users} />
        <KpiCard
          title="Ingresos del mes"
          value={`${currency} ${(monthRevenue/100).toLocaleString('es-AR')}`}
          icon={TrendingUp}
        />
        <KpiCard title="Asistencia hoy" value={todayAttendance} icon={CheckSquare} />
        <KpiCard title="Clases activas" value={activeClasses} icon={Calendar} />
      </div>

      {/* Expiring alert */}
      {expiringCount > 0 && (
        <Link
          href="members?status=expiring"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {expiringCount} membresía{expiringCount !== 1 ? 's' : ''} vence{expiringCount === 1 ? '' : 'n'} pronto — revisar
        </Link>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent members */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Últimos miembros</h2>
            <Link href="members" className="text-xs font-semibold text-[#1fad9d] hover:underline">Ver todos</Link>
          </div>
          {recentMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin miembros registrados</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recentMembers.map(m => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="h-8 w-8 rounded-full bg-[#1fad9d]/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-[#0e7a70]">
                      {(m.firstName[0] + (m.lastName[0] ?? '')).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 truncate">{m.firstName} {m.lastName}</p>
                    <p className="text-xs text-zinc-400 truncate">{m.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Today's attendance */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Asistencia hoy</h2>
            <Link href="attendance" className="text-xs font-semibold text-[#1fad9d] hover:underline">Ver todo</Link>
          </div>
          {todayAttendance === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros hoy</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(attendanceRaw ?? []).slice(0, 5).map(a => {
                const name = a.member
                  ? `${a.member.firstName} ${a.member.lastName}`
                  : a.memberId.slice(0, 8) + '…'
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-black text-zinc-500">
                        {a.member ? (a.member.firstName[0] + (a.member.lastName[0] ?? '')).toUpperCase() : '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 truncate">{name}</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(a.checkIn).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: tz })}
                        {a.checkOut ? ' — salida registrada' : ' — en el gimnasio'}
                      </p>
                    </div>
                  </li>
                )
              })}
              {todayAttendance > 5 && (
                <li className="pt-2.5 text-xs text-zinc-400 text-center">+{todayAttendance - 5} más</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {advancedEnabled && (
        <AdvancedReportsSection gymSlug={gymSlug} data={advancedReport} />
      )}

      {newParam === 'member' && (
        <Suspense>
          <NewMemberModal gymSlug={gymSlug} />
        </Suspense>
      )}

      {modal === 'checkin' && (
        <Suspense>
          <QuickCheckInModal gymSlug={gymSlug} />
        </Suspense>
      )}
    </div>
  )
}
