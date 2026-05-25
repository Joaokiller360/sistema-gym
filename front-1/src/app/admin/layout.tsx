import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { FooterBar } from '@/components/shared/FooterBar'

interface PlatformSettings { saasName: string }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) redirect('/inicio')

  const session = await verifyToken(token)
  if (!session) redirect('/inicio')
  if (session.role !== 'SUPER_ADMIN') notFound()

  const platform = await apiFetch<PlatformSettings>('/platform-settings', token, {
    next: { tags: ['platform-settings'] },
  })
  const saasName = platform?.saasName ?? 'GymOS'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar user={{ email: session.email }} saasName={saasName} />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0 flex flex-col">
        <div className="flex-1">
          {children}
        </div>
        <FooterBar />
      </main>
    </div>
  )
}
