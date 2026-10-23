import { Suspense } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { Plus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Plan } from '@/types'
import { PlansTable } from './PlansTable'
import { PlanDrawer } from './PlanDrawer'

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ new?: string; edit?: string }>
}

export default async function PlansPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { new: newParam, edit: editParam } = await searchParams

  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const gymHeader = { 'x-gym-slug': gymSlug }

  const [plansRaw, activeMemberships] = await Promise.all([
    apiFetch<Plan[]>(`/plans`, token, {
      next: { tags: [`plans-${gymSlug}`] },
      headers: gymHeader,
    }),
    apiFetch<{ planId: string }[]>(`/memberships?status=ACTIVE`, token, {
      headers: gymHeader,
      silent: true,
    }),
  ])
  const plans = plansRaw ?? []

  const memberCounts: Record<string, number> = {}
  for (const m of activeMemberships ?? []) memberCounts[m.planId] = (memberCounts[m.planId] ?? 0) + 1
  const totalMembers = Object.values(memberCounts).reduce((a, b) => a + b, 0)
  const activeCount = plans.filter(p => p.isActive).length

  const editPlan = editParam ? plans.find(p => p.id === editParam) ?? null : null
  const featured = plans.find(p => p.isFeatured && p.isActive) ?? null

  return (
    <div className="dark admin-surface min-h-full bg-adm-ground px-4 pb-14 pt-8 text-adm-ink sm:px-8 sm:pt-9">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <h1 className="text-[34px] font-black tracking-[-0.02em]">Tarifario</h1>
            <p className="font-admin-mono text-sm text-adm-muted">
              {plans.length} {plans.length === 1 ? 'plan' : 'planes'} · {activeCount} {activeCount === 1 ? 'activo' : 'activos'} · {totalMembers} socios
            </p>
          </div>
          <Link
            href="?new=plan"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-adm-brand px-[18px] text-sm font-black text-adm-night transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
            Nuevo plan
          </Link>
        </header>

        {plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-[18px] border border-dashed border-adm-line py-20 text-center">
            <p className="text-sm text-adm-muted">No hay planes creados todavía.</p>
            <Link href="?new=plan" className="inline-flex h-11 items-center rounded-xl border border-adm-ink px-4 text-sm font-bold">
              Crear primer plan
            </Link>
          </div>
        ) : (
          <PlansTable plans={plans} memberCounts={memberCounts} gymSlug={gymSlug} />
        )}
      </div>

      {(newParam === 'plan' || editPlan) && (
        <Suspense>
          <PlanDrawer
            key={editPlan?.id ?? 'new'}
            gymSlug={gymSlug}
            plan={editPlan}
            members={editPlan ? memberCounts[editPlan.id] ?? 0 : 0}
            featured={featured}
          />
        </Suspense>
      )}
    </div>
  )
}
