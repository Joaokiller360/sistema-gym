import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { GymSidebar } from '@/components/gym/GymSidebar'
import { FooterBar } from '@/components/shared/FooterBar'
import { Gym } from '@/types'

interface PlatformSettings { saasName: string }

interface Props {
  children: React.ReactNode
  params: Promise<{ gymSlug: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ gymSlug: string }> }): Promise<Metadata> {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const [gym, platform] = await Promise.all([
    apiFetch<Gym>(`/gyms/${gymSlug}`, token, { next: { tags: [`gym-${gymSlug}`] } }),
    apiFetch<PlatformSettings>('/platform-settings', token, { next: { tags: ['platform-settings'] } }),
  ])
  const saasName = platform?.saasName ?? 'GymOS'
  const name = gym?.name ?? gymSlug
  return { title: `${saasName} | ${name}` }
}

export default async function GymLayout({ children, params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) redirect('/inicio')

  const session = await verifyToken(token)
  if (!session) redirect('/inicio')

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
    <div className="flex h-screen overflow-hidden bg-background">
      <GymSidebar
        gymSlug={gymSlug}
        gymName={gymName}
        gymLogo={gym?.logoUrl ?? undefined}
        gymPlan={gym.subscriptionPlan ?? undefined}
        userEmail={session.email}
        userRole={session.role}
        storeEnabled={gym.storeEnabled}
      />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0 flex flex-col">
        <div className="flex-1">
          {children}
        </div>
        <FooterBar />
      </main>
    </div>
  )
}
