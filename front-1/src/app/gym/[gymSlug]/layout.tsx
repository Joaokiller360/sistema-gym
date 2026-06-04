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
  const gymLogo = gym.logoUrl
    ? gym.logoUrl.replace(/^https?:\/\/[^/]+/, '')
    : undefined
  const trialDaysLeft = isTrial && gym.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(gym.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <>
      {/* Full-width top banner */}
      {isTrial && (
        <div className="fixed top-0 left-0 right-0 z-50 h-8 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center gap-1.5 px-4">
          <span className="text-xs font-semibold text-white/90 tracking-wide">Prueba gratuita</span>
          {trialDaysLeft !== null && (
            <>
              <span className="text-white/50 text-xs">·</span>
              <span className="text-xs font-bold text-white">
                {trialDaysLeft === 0 ? 'último día' : `${trialDaysLeft} día${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}`}
              </span>
            </>
          )}
        </div>
      )}
      {!isTrial && (gym.demoEnabled ?? false) && (
        <div className="fixed top-0 left-0 right-0 z-50 h-8 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center gap-1.5 px-4">
          <span className="text-xs font-semibold text-white/90 tracking-wide">Demo habilitada</span>
          <span className="text-white/50 text-xs">·</span>
          <span className="text-xs text-white/75">Datos de ejemplo activos</span>
        </div>
      )}

      <div className={`flex h-screen overflow-hidden bg-background${hasBanner ? ' pt-8' : ''}`}>
        <GymSidebar
          gymSlug={gymSlug}
          gymName={gymName}
          gymLogo={gymLogo}
          gymPlan={gym.subscriptionPlan ?? undefined}
          gymSubscriptionStatus={gym.subscriptionStatus ?? undefined}
          gymTrialEndsAt={gym.trialEndsAt ?? undefined}
          gymDemoEnabled={gym.demoEnabled ?? false}
          hasBanner={hasBanner}
          userEmail={session.email}
          userRole={session.role}
          storeEnabled={gym.storeEnabled}
        />
        <main className={`flex-1 overflow-y-auto lg:pt-0 flex flex-col ${hasBanner ? 'pt-14' : 'pt-14'}`}>
          <div className="flex-1">
            {children}
          </div>
          <FooterBar />
        </main>
      </div>
    </>
  )
}
