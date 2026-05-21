import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PlanForm } from '../PlanForm'

interface Props {
  params: Promise<{ gymSlug: string }>
}

export default async function NewPlanPage({ params }: Props) {
  const { gymSlug } = await params

  return (
    <div className="p-8 space-y-6">
      <div>
        <Link
          href={`/gym/${gymSlug}/plans`}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            '-ml-2 mb-4 text-muted-foreground',
          )}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Volver a planes
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo plan</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Completá los datos para crear un nuevo plan
        </p>
      </div>
      <PlanForm gymSlug={gymSlug} />
    </div>
  )
}
