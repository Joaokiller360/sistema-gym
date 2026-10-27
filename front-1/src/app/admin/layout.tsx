import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { AdminSidebar, type AdminNavCounts } from '@/components/admin/AdminSidebar'
import { FooterBar } from '@/components/shared/FooterBar'

interface PlatformSettings { saasName: string; logoUrl?: string | null }
interface DashboardStats { totalGyms: number }
interface WithStatus { status: string }
type ListResponse<T> = T[] | { data: T[] }

function list<T>(raw: ListResponse<T> | null): T[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : raw.data ?? []
}

async function loadNavCounts(token: string): Promise<AdminNavCounts> {
  const [stats, access, demos, tickets] = await Promise.all([
    apiFetch<DashboardStats>('/admin/dashboard', token, { silent: true }),
    apiFetch<ListResponse<WithStatus>>('/access-requests/admin?limit=100', token, { silent: true }),
    apiFetch<ListResponse<WithStatus>>('/admin/demo-requests?limit=100', token, { silent: true }),
    apiFetch<ListResponse<WithStatus>>('/support/tickets?all=true', token, { silent: true }),
  ])
  const pending = (r: WithStatus) => r.status === 'PENDING'
  return {
    gyms: stats?.totalGyms,
    requests: list(access).filter(pending).length + list(demos).filter(pending).length,
    tickets: list(tickets).filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) redirect('/inicio')

  const session = await verifyToken(token)
  if (!session) redirect('/inicio')
  if (session.role !== 'SUPER_ADMIN') notFound()

  const [platform, counts] = await Promise.all([
    apiFetch<PlatformSettings>('/platform-settings', token, {
      next: { tags: ['platform-settings'], revalidate: 300 },
    }),
    loadNavCounts(token),
  ])
  const saasName = platform?.saasName ?? 'GymOS'

  return (
    <div className="admin-shell flex h-screen overflow-hidden">
      <AdminSidebar user={{ email: session.email }} saasName={saasName} logoUrl={platform?.logoUrl} counts={counts} />
      <main className="flex flex-1 flex-col overflow-y-auto pt-14 lg:pt-0">
        <div className="flex-1">{children}</div>
        <FooterBar />
      </main>
    </div>
  )
}
