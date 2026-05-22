import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { Plus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Plan } from '@/types'
import { PlansList } from './PlansList'
import { NewPlanModal } from './NewPlanModal'
import { EditPlanModal } from './EditPlanModal'

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ new?: string; edit?: string }>
}

export default async function PlansPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { new: newParam, edit: editParam } = await searchParams

  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const plans =
    (await apiFetch<Plan[]>(`/plans`, token, {
      next: { tags: [`plans-${gymSlug}`] },
      headers: { 'x-gym-slug': gymSlug },
    })) ?? []

  const editPlan = editParam
    ? await apiFetch<Plan>(`/plans/${editParam}`, token, {
        next: { tags: [`plan-${editParam}`] },
        headers: { 'x-gym-slug': gymSlug },
      })
    : null

  const sorted = [...plans].sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1
    if (!a.isFeatured && b.isFeatured) return 1
    return 0
  })

  const newPlanHref = `?new=plan`

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestioná los planes de tu gimnasio
          </p>
        </div>
        <a
          href={newPlanHref}
          className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-all active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Nuevo plan
        </a>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <p className="text-muted-foreground text-sm">No hay planes creados todavía.</p>
          <a
            href={newPlanHref}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-300 transition-all"
          >
            Crear primer plan
          </a>
        </div>
      ) : (
        <PlansList plans={sorted} gymSlug={gymSlug} />
      )}

      {newParam === 'plan' && (
        <Suspense>
          <NewPlanModal gymSlug={gymSlug} />
        </Suspense>
      )}

      {editParam && editPlan && (
        <Suspense>
          <EditPlanModal gymSlug={gymSlug} plan={editPlan} />
        </Suspense>
      )}
    </div>
  )
}
