import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Attendance, Member } from '@/types'
import { DateFilter } from './DateFilter'
import { CheckInPanel } from './CheckInPanel'

interface AttendanceWithMember extends Attendance {
  member?: { id: string; firstName: string; lastName: string } | null
}

interface MembersResponse { data: Member[]; total: number }

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ date?: string }>
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}


function dur(checkIn: string, checkOut: string) {
  const mins = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60_000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export default async function AttendancePage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { date } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const target = date ? new Date(date + 'T00:00:00') : new Date()
  const startDate = new Date(target.getFullYear(), target.getMonth(), target.getDate()).toISOString()
  const endDate = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59).toISOString()

  const [attendance, membersRaw] = await Promise.all([
    apiFetch<AttendanceWithMember[]>(
      `/attendance?startDate=${startDate}&endDate=${endDate}`,
      token,
      { next: { tags: [`attendance-${gymSlug}`] }, headers: { 'x-gym-slug': gymSlug } },
    ),
    apiFetch<MembersResponse | Member[]>('/members?limit=500', token, { headers: { 'x-gym-slug': gymSlug } }),
  ])

  const records = attendance ?? []
  const activeNow = records.filter(a => !a.checkOut)
  const completed = records.filter(a => a.checkOut)

  const members: Member[] = membersRaw
    ? (Array.isArray(membersRaw) ? membersRaw : membersRaw.data)
    : []

  const displayDate = target.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const todayStr = new Date().toISOString().split('T')[0]
  const isToday = !date || date === todayStr

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asistencia</h1>
          <p className="text-muted-foreground text-sm mt-1 capitalize">{displayDate}</p>
        </div>
        <DateFilter defaultValue={date ?? todayStr} />
      </div>

      {/* Check-in panel — only for today */}
      {isToday && (
        <CheckInPanel gymSlug={gymSlug} activeNow={activeNow} members={members} />
      )}

      {/* History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            {isToday ? 'Salidas registradas hoy' : `Registros del día (${records.length})`}
          </h2>
        </div>

        {(isToday ? completed : records).length === 0 ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-300 py-16">
            <p className="text-muted-foreground text-sm">Sin registros completados</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Miembro</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Entrada</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Salida</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(isToday ? completed : records).map(a => {
                  const name = a.member
                    ? `${a.member.firstName} ${a.member.lastName}`
                    : a.memberId.slice(0, 8) + '…'
                  return (
                    <tr key={a.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-3.5 font-medium">{name}</td>
                      <td className="px-5 py-3.5 text-zinc-500">{fmt(a.checkIn)}</td>
                      <td className="px-5 py-3.5 text-zinc-500 hidden sm:table-cell">
                        {a.checkOut ? fmt(a.checkOut) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[#1fad9d] font-semibold hidden sm:table-cell">
                        {a.checkOut ? dur(a.checkIn, a.checkOut) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
