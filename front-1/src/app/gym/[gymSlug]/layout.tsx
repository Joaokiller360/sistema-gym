import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
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

// Cached at server level — platform settings are global, same for all users.
// token excluded from cache key intentionally so all users share one cached value.
const getCachedPlatformSettings = unstable_cache(
  (token: string) => apiFetch<PlatformSettings>('/platform-settings', token, { silent: true }),
  ['platform-settings'],
  { revalidate: 300, tags: ['platform-settings'] },
)

export async function generateMetadata({ params }: { params: Promise<{ gymSlug: string }> }): Promise<Metadata> {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const [gym, platform] = await Promise.all([
    apiFetch<Gym>(`/gyms/${gymSlug}`, token, { next: { tags: [`gym-${gymSlug}`] } }),
    getCachedPlatformSettings(token),
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

  const gym = await apiFetch<Gym>(`/gyms/${gymSlug}`, token, {
    next: { tags: [`gym-${gymSlug}`] },
  })

  if (!gym) notFound()
  // Use gymId (not slug) so auth survives slug renames without re-login
  if (!isSuperAdmin && session.gymId !== gym.id) notFound()

  const gymName = gym.name
  const isTrial = gym.subscriptionStatus === 'TRIAL'
  const hasBanner = isTrial || (gym.demoEnabled ?? false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GymSidebar
        gymSlug={gymSlug}
        gymName={gymName}
        gymLogo={gym?.logoUrl ?? undefined}
        gymPlan={gym.subscriptionPlan ?? undefined}
        gymSubscriptionStatus={gym.subscriptionStatus ?? undefined}
        gymTrialEndsAt={gym.trialEndsAt ?? undefined}
        gymDemoEnabled={gym.demoEnabled ?? false}
        userEmail={session.email}
        userRole={session.role}
        storeEnabled={gym.storeEnabled}
      />
      <main className={`flex-1 overflow-y-auto lg:pt-0 flex flex-col ${hasBanner ? 'pt-[88px]' : 'pt-14'}`}>
        <div className="flex-1">
          {children}
        </div>
        <FooterBar />
      </main>
    </div>
  )
}
