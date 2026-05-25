import { getPlatformSettingsAction } from './actions'
import { PlatformSettingsForm } from './PlatformSettingsForm'

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettingsAction()

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Configuración global de la plataforma</p>
      </div>

      <PlatformSettingsForm settings={settings} />
    </div>
  )
}
