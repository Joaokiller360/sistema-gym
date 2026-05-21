import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="text-center space-y-4 max-w-sm">
        <ShieldX className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Acceso denegado</h1>
        <p className="text-muted-foreground text-sm">
          No tenés permisos para acceder a esta sección.
        </p>
        <Link href="/login" className={cn(buttonVariants({ variant: 'outline' }))}>
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
