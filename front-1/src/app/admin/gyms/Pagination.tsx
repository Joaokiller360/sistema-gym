'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface PaginationProps {
  currentPage: number
  totalPages: number
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  function goTo(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Página {currentPage} de {totalPages}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage <= 1}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'disabled:opacity-50',
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'disabled:opacity-50',
          )}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
