import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) notFound()

  const session = await verifyToken(token)
  if (!session || session.role !== 'SUPER_ADMIN') notFound()

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <AdminSidebar user={{ email: session.email }} />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
