import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { getPlatformSettingsAction } from '@/app/admin/settings/actions'
import { SlotsConfigPanel } from '@/app/admin/dashboard/SlotsConfigPanel'
import { DemoRequestsSection, type DemoRequest } from '@/app/admin/dashboard/DemoRequestsSection'
import { AccessRequestsPanel, type AccessRequest } from '@/app/admin/dashboard/AccessRequestsPanel'

export default async function AccesoPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const [demoRequestsRaw, accessRequestsRaw, platformSettings] = await Promise.all([
    apiFetch<DemoRequest[] | { data: DemoRequest[] }>(`/admin/demo-requests?limit=100`, token, { silent: true }),
    apiFetch<AccessRequest[] | { data: AccessRequest[] }>(`/access-requests/admin?limit=100`, token, { silent: true }),
    getPlatformSettingsAction(),
  ])

  const demoRequests: DemoRequest[] = demoRequestsRaw
    ? (Array.isArray(demoRequestsRaw) ? demoRequestsRaw : demoRequestsRaw.data)
    : []

  const accessRequests: AccessRequest[] = accessRequestsRaw
    ? (Array.isArray(accessRequestsRaw) ? accessRequestsRaw : accessRequestsRaw.data)
    : []

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Solicitudes de acceso</h1>
        <p className="text-muted-foreground text-sm mt-1">Configurá horarios y gestioná las solicitudes</p>
      </div>

      <SlotsConfigPanel initialSlots={platformSettings.availableSlots ?? []} />

      <AccessRequestsPanel requests={accessRequests} />

      <DemoRequestsSection requests={demoRequests} />
    </div>
  )
}
