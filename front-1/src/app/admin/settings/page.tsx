import { getPlatformSettingsAction } from './actions'
import { PlatformSettingsForm } from './PlatformSettingsForm'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettingsAction()

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground text-sm mt-1">Identidad, landing page, footer y términos de la plataforma</p>
        </div>
        <Link
          href="/inicio"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500 hover:border-zinc-400 hover:text-black transition-all shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ver landing
        </Link>
      </div>

      <PlatformSettingsForm settings={settings} />
    </div>
  )
}
