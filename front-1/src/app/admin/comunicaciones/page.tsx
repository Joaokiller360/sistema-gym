import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Gym, Communication } from '@/types'
import { AdminPage } from '@/components/admin/ui'
import { ComunicacionesClient } from './ComunicacionesClient'

interface GymListResponse { data: Gym[]; total: number }
interface AdminProfile { name?: string; email: string }
interface PlatformSettings { saasName: string }

export default async function ComunicacionesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const [raw, history, profile, platform] = await Promise.all([
    apiFetch<GymListResponse | Gym[]>('/admin/gyms?limit=200', token, { silent: true }),
    apiFetch<Communication[]>('/admin/comunicaciones/history', token, { silent: true }),
    apiFetch<AdminProfile>('/auth/me', token, { silent: true }),
    apiFetch<PlatformSettings>('/platform-settings', token, {
      next: { tags: ['platform-settings'], revalidate: 300 },
      silent: true,
    }),
  ])

  const gyms: Gym[] = raw ? (Array.isArray(raw) ? raw : raw.data) : []
  const sent: Communication[] = history ?? []
  const adminName = profile?.name?.trim() || profile?.email || 'Soporte'

  return (
    <AdminPage>
      <ComunicacionesClient gyms={gyms} history={sent} adminName={adminName} saasName={platform?.saasName ?? 'GymOS'} />
    </AdminPage>
  )
}
