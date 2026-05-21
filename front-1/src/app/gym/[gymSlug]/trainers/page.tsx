import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Trainer } from '@/types'
import { TrainerCreateButton, DeleteTrainerButton } from './TrainerActions'

interface Props {
  params: Promise<{ gymSlug: string }>
}

export default async function TrainersPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const trainers = await apiFetch<Trainer[]>(`/trainers`, token, {
    next: { tags: [`trainers-${gymSlug}`] },
  }) ?? []

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entrenadores</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {trainers.length} entrenador{trainers.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <TrainerCreateButton gymSlug={gymSlug} />
      </div>

      {trainers.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-300 py-20">
          <p className="text-muted-foreground text-sm">No hay entrenadores registrados</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Nombre</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Email</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden md:table-cell">Teléfono</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden md:table-cell">Especialidad</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {trainers.map(t => (
                <tr key={t.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-3.5 font-semibold">{t.firstName} {t.lastName}</td>
                  <td className="px-5 py-3.5 text-zinc-500 hidden sm:table-cell">{t.email}</td>
                  <td className="px-5 py-3.5 text-zinc-500 hidden md:table-cell">{t.phone ?? '—'}</td>
                  <td className="px-5 py-3.5 text-zinc-500 hidden md:table-cell">{t.specialty ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      t.isActive
                        ? 'bg-[#1fad9d]/15 text-[#0e7a70] border border-[#1fad9d]/30'
                        : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                    }`}>
                      {t.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <DeleteTrainerButton gymSlug={gymSlug} trainerId={t.id} />
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
