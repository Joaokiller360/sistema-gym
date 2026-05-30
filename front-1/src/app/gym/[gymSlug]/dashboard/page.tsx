import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { Users, TrendingUp, CheckSquare, Calendar, UserPlus, ClipboardList, Dumbbell, BarChart2 } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { KpiCard } from '@/components/shared/KpiCard'
import { Member, Attendance, Plan, Class, Gym } from '@/types'
import { NewMemberModal } from '../members/NewMemberModal'
import { NewsSection } from './NewsSection'
import { TutorialsSection } from './TutorialsSection'
import { AdvancedReportsSection, type AdvancedReport } from './AdvancedReportsSection'

interface MembersResponse { data: Member[]; total: number }
interface FinancialReport { totalRevenue: number; currency: string }

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ new?: string }>
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString()
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

export default async function GymDashboardPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { new: newParam } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const session = await verifyToken(token)
  const isSuperAdmin = session?.role === 'SUPER_ADMIN'

  const now = new Date()
  const qs = `startDate=${startOfDay(now)}&endDate=${endOfDay(now)}`

  const gym = await apiFetch<Gym>(`/gyms/${gymSlug}`, token)
  const gymIdParam = isSuperAdmin && gym ? `&gymId=${gym.id}` : ''

  const gymHeader = { headers: { 'x-gym-slug': gymSlug } }

  const advancedEnabled = gym?.advancedReportsEnabled ?? false

  const monthStart = startOfMonth(now)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [membersRaw, attendanceRaw, , classes, financial, advancedReport] = await Promise.all([
    apiFetch<MembersResponse | Member[]>(`/members?status=active&limit=5`, token, gymHeader),
    apiFetch<Attendance[]>(`/attendance?${qs}`, token, gymHeader),
    apiFetch<Plan[]>(`/plans`, token, gymHeader),
    apiFetch<Class[]>(`/classes`, token, gymHeader),
    apiFetch<FinancialReport>(`/reports/financial?startDate=${monthStart}${gymIdParam}`, token),
    advancedEnabled
      ? apiFetch<AdvancedReport>(`/reports/advanced?startDate=${monthStart}&endDate=${monthEnd}`, token, gymHeader)
      : Promise.resolve(null),
  ])

  const activeMembers = membersRaw
    ? Array.isArray(membersRaw) ? membersRaw.length : membersRaw.total
    : 0
  const todayAttendance = attendanceRaw?.length ?? 0
  const activeClasses = classes?.filter(c => c.isActive).length ?? 0
  const monthRevenue = financial?.totalRevenue ?? 0
  const currency = financial?.currency ?? 'ARS'

  const recentMembers: Member[] = membersRaw
    ? (Array.isArray(membersRaw) ? membersRaw : membersRaw.data).slice(0, 5)
    : []

  const QUICK_LINKS = [
    { href: `?new=member`, label: 'Nuevo miembro', icon: UserPlus, color: 'bg-[#1fad9d]/10 text-[#1fad9d] hover:bg-[#1fad9d]/20' },
    { href: `attendance`, label: 'Asistencia', icon: CheckSquare, color: 'bg-[#fffb00]/30 text-black hover:bg-[#fffb00]/50' },
    { href: `trainers`, label: 'Entrenadores', icon: Dumbbell, color: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' },
    { href: `plans`, label: 'Planes', icon: ClipboardList, color: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' },
    { href: `members`, label: 'Miembros', icon: Users, color: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' },
    { href: `reports`, label: 'Reportes', icon: BarChart2, color: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen del gimnasio</p>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Miembros activos" value={activeMembers} icon={Users} />
        <KpiCard title="Ingresos del mes" value={`${currency} ${(monthRevenue / 100).toLocaleString('es-AR')}`} icon={TrendingUp} />
        <KpiCard title="Asistencia hoy" value={todayAttendance} icon={CheckSquare} />
        <KpiCard title="Clases activas" value={activeClasses} icon={Calendar} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold mb-4">Últimos miembros</h2>
          {recentMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin miembros registrados</p>
          ) : (
            <ul className="space-y-3">
              {recentMembers.map(m => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{m.firstName} {m.lastName}</span>
                  <span className="text-muted-foreground truncate max-w-[160px]">{m.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold mb-4">Asistencia de hoy</h2>
          {todayAttendance === 0 ? (
            <p className="text-sm text-muted-foreground">Sin registros hoy</p>
          ) : (
            <ul className="space-y-3">
              {attendanceRaw!.slice(0, 5).map(a => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {new Date(a.checkIn).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>{a.checkOut ? 'Salida registrada' : 'En el gimnasio'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {advancedEnabled && (
        <AdvancedReportsSection
          gymSlug={gymSlug}
          data={advancedReport}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NewsSection canManage={isSuperAdmin} />
        <TutorialsSection canManage={isSuperAdmin} />
      </div>

      {newParam === 'member' && (
        <Suspense>
          <NewMemberModal gymSlug={gymSlug} />
        </Suspense>
      )}
    </div>
  )
}
