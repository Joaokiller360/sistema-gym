import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { NewMemberForm } from './NewMemberForm'

interface Props {
  params: Promise<{ gymSlug: string }>
}

export default async function NewMemberPage({ params }: Props) {
  const { gymSlug } = await params

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-2xl">
      <div>
        <Link
          href={`/gym/${gymSlug}/members`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2 mb-4 text-muted-foreground')}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Volver a miembros
        </Link>
        <h1 className="text-2xl font-black tracking-tight">Nuevo miembro</h1>
        <p className="text-muted-foreground text-sm mt-1">Completá los datos del nuevo miembro</p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-6">
        <NewMemberForm gymSlug={gymSlug} />
      </div>
    </div>
  )
}
