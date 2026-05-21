import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { GymSidebar } from '@/components/gym/GymSidebar'
import { Gym } from '@/types'

interface Props {
  children: React.ReactNode
  params: Promise<{ gymSlug: string }>
}

export default async function GymLayout({ children, params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) notFound()

  const session = await verifyToken(token)
  if (!session) notFound()

  const isSuperAdmin = session.role === 'SUPER_ADMIN'
  const gymRoles = ['GYM_OWNER', 'GYM_ADMIN', 'TRAINER', 'RECEPTIONIST']
  if (!isSuperAdmin && !gymRoles.includes(session.role)) notFound()
  if (session.role === 'GYM_OWNER' && session.gymSlug !== gymSlug) notFound()

  const gym = await apiFetch<Gym>(`/gyms/${gymSlug}`, token, {
    next: { tags: [`gym-${gymSlug}`] },
  })

  if (!gym) notFound()

  const gymName = gym.name

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <GymSidebar
        gymSlug={gymSlug}
        gymName={gymName}
        gymLogo={gym?.logoUrl ?? undefined}
        userEmail={session.email}
        userRole={session.role}
      />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
