import Link from 'next/link'
import { cookies } from 'next/headers'
import { Plus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Plan } from '@/types'
import { PlansList } from './PlansList'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface Props {
  params: Promise<{ gymSlug: string }>
}

export default async function PlansPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const plans =
    (await apiFetch<Plan[]>(`/plans`, token, {
      next: { tags: [`plans-${gymSlug}`] },
    })) ?? []

  const sorted = [...plans].sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1
    if (!a.isFeatured && b.isFeatured) return 1
    return 0
  })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestioná los planes de tu gimnasio
          </p>
        </div>
        <Link
          href={`/gym/${gymSlug}/plans/new`}
          className={cn(buttonVariants())}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo plan
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <p className="text-muted-foreground text-sm">No hay planes creados todavía.</p>
          <Link
            href={`/gym/${gymSlug}/plans/new`}
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
          >
            Crear primer plan
          </Link>
        </div>
      ) : (
        <PlansList plans={sorted} gymSlug={gymSlug} />
      )}
    </div>
  )
}
