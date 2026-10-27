import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Trainer } from '@/types'
import { TrainerCreateButton, DeleteTrainerButton } from './TrainerActions'
import { getT } from '@/i18n/server'
import { trainersMessages } from './messages'

interface Props {
  params: Promise<{ gymSlug: string }>
}

export default async function TrainersPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const t = await getT(trainersMessages)

  const trainers = await apiFetch<Trainer[]>(`/trainers`, token, {
    next: { tags: [`trainers-${gymSlug}`] },
  }) ?? []

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t.count(trainers.length)}
          </p>
        </div>
        <TrainerCreateButton gymSlug={gymSlug} />
      </div>

      {trainers.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-300 py-20">
          <p className="text-muted-foreground text-sm">{t.empty}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{t.colName}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden sm:table-cell">{t.colEmail}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden md:table-cell">{t.colPhone}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden md:table-cell">{t.colSpecialty}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{t.colStatus}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {trainers.map(tr => (
                <tr key={tr.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-3.5 font-semibold">{tr.firstName} {tr.lastName}</td>
                  <td className="px-5 py-3.5 text-zinc-500 hidden sm:table-cell">{tr.email}</td>
                  <td className="px-5 py-3.5 text-zinc-500 hidden md:table-cell">{tr.phone ?? '—'}</td>
                  <td className="px-5 py-3.5 text-zinc-500 hidden md:table-cell">{tr.specialty ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      tr.isActive
                        ? 'bg-[#1fad9d]/15 text-[#0e7a70] border border-[#1fad9d]/30'
                        : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                    }`}>
                      {tr.isActive ? t.active : t.inactive}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <DeleteTrainerButton gymSlug={gymSlug} trainerId={tr.id} />
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
