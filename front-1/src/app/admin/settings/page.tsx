import { Separator } from '@/components/ui/separator'

export default function AdminSettingsPage() {
  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Configuración global de la plataforma</p>
      </div>

      <Separator />

      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-6 space-y-2">
          <h2 className="font-semibold">Plataforma</h2>
          <p className="text-sm text-muted-foreground">GymOS SaaS — Gestión de gimnasios</p>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-2">
          <h2 className="font-semibold">API</h2>
          <p className="text-sm text-muted-foreground">
            Base URL:{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
              {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}
            </code>
          </p>
        </div>
      </div>
    </div>
  )
}
