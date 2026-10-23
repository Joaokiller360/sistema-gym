import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { getPlatformSettingsAction } from '@/app/admin/settings/actions'
import { AdminPage, PageHeader } from '@/components/admin/ui'
import { SlotsConfigPanel } from './SlotsConfigPanel'
import { RequestsInbox, type AccessRequest, type DemoRequest } from './RequestsInbox'

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function AccesoPage({ searchParams }: Props) {
  const { tab } = await searchParams
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
    <AdminPage>
      <PageHeader eyebrow="Pedidos que llegan desde la landing" title="Solicitudes" />
      <RequestsInbox
        accessRequests={accessRequests}
        demoRequests={demoRequests}
        initialTab={tab === 'demo' ? 'demo' : 'access'}
      />
      <SlotsConfigPanel initialSlots={platformSettings.availableSlots ?? []} />
    </AdminPage>
  )
}
