import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { verifyToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { GymSidebar } from '@/components/gym/GymSidebar'
import { FooterBar } from '@/components/shared/FooterBar'
import { GymTour } from '@/components/gym/GymTour'
import { shellMessages } from '@/components/gym/messages'
import { LocaleProvider } from '@/i18n/client'
import { isLocale } from '@/i18n/config'
import { LocaleSync } from '@/i18n/LocaleSync'
import { getLocale } from '@/i18n/server'
import { Gym } from '@/types'
import { normalizeLogoUrl } from '@/lib/utils'

interface PlatformSettings { saasName: string; logoUrl?: string | null }

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
  // Tab icon: the gym's own logo, else the platform logo, else favicon.ico
  const icon = normalizeLogoUrl(gym?.logoUrl) ?? normalizeLogoUrl(platform?.logoUrl) ?? '/favicon.ico'
  return { title: `${saasName} | ${name}`, icons: { icon, apple: icon } }
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

  const [gym, me, locale] = await Promise.all([
    apiFetch<Gym>(`/gyms/${gymSlug}`, token, {
      next: { tags: [`gym-${gymSlug}`] },
    }),
    apiFetch<{ tourCompletedAt?: string | null; language?: string }>('/auth/me', token, { silent: true }),
    getLocale(),
  ])
  const t = shellMessages[locale]
  const localeOutOfSync = isLocale(me?.language) && me.language !== locale

  if (!gym) notFound()
  // Use gymId (not slug) so auth survives slug renames without re-login
  if (!isSuperAdmin && session.gymId !== gym.id) notFound()

  const gymName = gym.name
  const isTrial = gym.subscriptionStatus === 'TRIAL'
  const hasBanner = isTrial || (gym.demoEnabled ?? false)
  const gymLogo = gym.logoUrl
    ? gym.logoUrl.replace(/^https?:\/\/[^/]+/, '')
    : undefined
  // New gym owners/admins get the guided tour once; anyone can replay it from the sidebar.
  const autoTour = ['GYM_OWNER', 'GYM_ADMIN'].includes(session.role) && me?.tourCompletedAt === null
  const trialDaysLeft = isTrial && gym.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(gym.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <LocaleProvider locale={locale}>
      {localeOutOfSync && <LocaleSync />}
      {/* Full-width top banner */}
      {isTrial && (
        <div className="fixed inset-x-0 top-0 z-50 flex h-8 items-center justify-center gap-1.5 border-b border-adm-warn-line bg-adm-warn-bg px-4 font-admin text-adm-warn-fg">
          <span className="text-xs font-semibold tracking-wide">{t.trial}</span>
          {trialDaysLeft !== null && (
            <>
              <span className="text-xs opacity-60">·</span>
              <span className="font-admin-mono text-xs font-bold">
                {trialDaysLeft === 0 ? t.trialLastDay : t.trialDaysLeft(trialDaysLeft)}
              </span>
            </>
          )}
        </div>
      )}
      {!isTrial && (gym.demoEnabled ?? false) && (
        <div className="fixed inset-x-0 top-0 z-50 flex h-8 items-center justify-center gap-1.5 border-b border-adm-info-line bg-adm-info-bg px-4 font-admin text-adm-info-fg">
          <span className="text-xs font-semibold tracking-wide">{t.demoEnabled}</span>
          <span className="text-xs opacity-60">·</span>
          <span className="text-xs">{t.demoData}</span>
        </div>
      )}

      <div lang={locale} className={`flex h-screen overflow-hidden bg-background${hasBanner ? ' pt-8' : ''}`}>
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
        <GymTour gymSlug={gymSlug} autoStart={autoTour} storeEnabled={gym.storeEnabled} userRole={session.role} />
        <main className={`flex-1 overflow-y-auto lg:pt-0 flex flex-col ${hasBanner ? 'pt-14' : 'pt-14'}`}>
          <div className="flex-1">
            {children}
          </div>
          <FooterBar />
        </main>
      </div>
    </LocaleProvider>
  )
}
