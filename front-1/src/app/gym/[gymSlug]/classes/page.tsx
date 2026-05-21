import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { ClassWithRelations } from '@/types'
import { StatusBadge } from '@/components/shared/StatusBadge'

interface Props {
  params: Promise<{ gymSlug: string }>
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default async function ClassesPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const classes = await apiFetch<ClassWithRelations[]>(`/classes`, token, {
    next: { tags: [`classes-${gymSlug}`] },
  }) ?? []

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clases</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {classes.length} clase{classes.length !== 1 ? 's' : ''}
        </p>
      </div>

      {classes.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-20">
          <p className="text-muted-foreground text-sm">Proximamente clases a registradas</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Clase</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Día</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Horario</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Capacidad</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entrenador</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {classes.map(c => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {DAYS[c.schedule.dayOfWeek] ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.schedule.startTime} – {c.schedule.endTime}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c._count?.enrollments ?? 0} / {c.maxCapacity}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.trainer ? `${c.trainer.firstName} ${c.trainer.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.isActive ? 'active' : 'inactive'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
