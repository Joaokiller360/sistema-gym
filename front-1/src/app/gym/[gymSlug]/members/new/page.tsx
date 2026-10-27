import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { NewMemberForm } from './NewMemberForm'
import { getT } from '@/i18n/server'
import { membersMessages } from '../messages'

interface Props {
  params: Promise<{ gymSlug: string }>
}

export default async function NewMemberPage({ params }: Props) {
  const { gymSlug } = await params
  const t = (await getT(membersMessages)).form

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-2xl">
      <div>
        <Link
          href={`/gym/${gymSlug}/members`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2 mb-4 text-muted-foreground')}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t.backToMembers}
        </Link>
        <h1 className="text-2xl font-black tracking-tight">{t.pageTitle}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.pageDesc}</p>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-6">
        <NewMemberForm gymSlug={gymSlug} />
      </div>
    </div>
  )
}
