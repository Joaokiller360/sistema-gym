import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { ClassWithRelations } from '@/types'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { getT } from '@/i18n/server'
import { commonMessages } from '@/i18n/common'
import { classesMessages } from './messages'

interface Props {
  params: Promise<{ gymSlug: string }>
}

// dayOfWeek: 0 = Sunday
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export default async function ClassesPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const [t, tc] = await Promise.all([getT(classesMessages), getT(commonMessages)])

  const classes = await apiFetch<ClassWithRelations[]>(`/classes`, token, {
    next: { tags: [`classes-${gymSlug}`] },
  }) ?? []

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t.count(classes.length)}
        </p>
      </div>

      {classes.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-20">
          <p className="text-muted-foreground text-sm">{t.empty}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colClass}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colDay}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colTime}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colCapacity}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colTrainer}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {classes.map(c => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tc.weekdaysShort[DAY_KEYS[c.schedule.dayOfWeek]] ?? '—'}
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
