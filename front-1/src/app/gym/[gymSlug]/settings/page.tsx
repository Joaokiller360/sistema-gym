import Link from 'next/link'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Gym } from '@/types'
import { GymSettingsForm } from './GymSettingsForm'
import { ChangePasswordForm } from './ChangePasswordForm'
import { AdminsSection } from './AdminsSection'
import { GymScheduleEditor } from './GymScheduleEditor'
import { getGymAdminsAction } from './actions'
import { settingsMessages } from './messages'
import { LanguageSwitcher } from '@/components/gym/LanguageSwitcher'
import { getT } from '@/i18n/server'

interface CountryOption { code: string; label: string; timezone: string; utcOffset: string }
interface GymStatus { timezone: string; localTime: string; isOpen: boolean | null }
type Tab = 'gimnasio' | 'equipo'

// URL keys stay stable across languages; only the labels are translated.
const TAB_KEYS: Tab[] = ['gimnasio', 'equipo']

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const resolveLogoUrl = (url: string | null | undefined): string | null =>
  url ? url.replace(/^https?:\/\/[^/]+/, '') : null

/** Today's opening hours in the gym's timezone, from its saved weekly schedule. */
function todayHours(schedule: Gym['schedule'], tz: string) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(new Date()).toLowerCase().slice(0, 3)
  const key = DAY_KEYS.find(k => k === weekday)
  return key ? schedule?.[key] ?? null : null
}

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function SettingsPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { tab: rawTab } = await searchParams
  const tab: Tab = rawTab === 'equipo' ? 'equipo' : 'gimnasio'
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const t = (await getT(settingsMessages)).page
  const tabLabel: Record<Tab, string> = { gimnasio: t.tabGym, equipo: t.tabTeam }

  const [gym, admins, countries, status] = await Promise.all([
    apiFetch<Gym>(`/gyms/${gymSlug}`, token, { next: { tags: [`gym-${gymSlug}`] } }),
    tab === 'equipo' ? getGymAdminsAction() : Promise.resolve([]),
    apiFetch<CountryOption[]>('/gyms/countries', token, { next: { revalidate: 86400 } }),
    apiFetch<GymStatus>(`/gyms/${gymSlug}/status`, token, { silent: true }),
  ])

  const logoUrl = resolveLogoUrl(gym?.logoUrl)
  const initials = (gym?.name ?? 'G').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const tz = status?.timezone ?? gym?.timezone ?? 'UTC'
  const hours = todayHours(gym?.schedule ?? null, tz)
  const statusLabel = status?.isOpen == null
    ? null
    : status.isOpen
      ? `${t.open}${hours ? ` · ${t.closesAt(hours.close)}` : ''}`
      : `${t.closed}${hours ? ` · ${t.opensAt(hours.open)}` : ''}`

  return (
    <div className="dark admin-surface min-h-full bg-adm-ground px-4 pb-14 pt-8 text-adm-ink sm:px-8">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-5">

        <header className="flex flex-wrap items-center gap-5 rounded-[22px] border border-adm-line bg-adm-surface p-5 sm:p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-adm-brand text-2xl font-black text-adm-night sm:h-[88px] sm:w-[88px] sm:rounded-3xl sm:text-[30px]">
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              : initials}
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-2">
            <p className="font-admin-mono text-xs uppercase text-adm-muted">{t.eyebrow} · /{gymSlug}</p>
            <h1 className="text-[28px] font-black leading-tight tracking-[-0.02em] sm:text-[34px]">{gym?.name ?? '—'}</h1>
            <div className="flex flex-wrap gap-2">
              {statusLabel && (
                <span className={`inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-[13px] font-bold ${
                  status?.isOpen ? 'bg-adm-ok-bg text-adm-ok-fg' : 'bg-adm-chip text-adm-muted'
                }`}>
                  <span className={`h-[7px] w-[7px] rounded-full ${status?.isOpen ? 'bg-[#2cc4b2]' : 'bg-adm-muted'}`} />
                  {statusLabel}
                </span>
              )}
              <span className="inline-flex h-[30px] items-center rounded-full bg-adm-chip px-3 font-admin-mono text-xs font-semibold text-adm-ink">
                {tz}{status?.localTime ? ` · ${status.localTime}` : ''}
              </span>
              {gym?.subscriptionPlan && (
                <span className="inline-flex h-[30px] items-center rounded-full border border-adm-line px-3 text-[13px] font-bold capitalize">
                  {t.plan(gym.subscriptionPlan.toLowerCase())}
                </span>
              )}
            </div>
          </div>
          <nav aria-label={t.tabsLabel} className="flex gap-1 rounded-[14px] border border-adm-line bg-adm-ground p-1">
            {TAB_KEYS.map(key => {
              const on = key === tab
              return (
                <Link
                  key={key}
                  href={key === 'gimnasio' ? '?' : `?tab=${key}`}
                  aria-current={on ? 'page' : undefined}
                  className={`inline-flex h-11 items-center rounded-[10px] px-4 text-sm transition-colors ${
                    on ? 'bg-adm-ink font-extrabold text-adm-ground' : 'font-bold text-adm-muted hover:text-adm-ink'
                  }`}
                >
                  {tabLabel[key]}
                </Link>
              )
            })}
          </nav>
        </header>

        {tab === 'gimnasio' ? (
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
              <GymSettingsForm
                gymSlug={gymSlug}
                gymId={gym?.id ?? ''}
                defaultName={gym?.name ?? ''}
                defaultLogoUrl={logoUrl}
                defaultCurrency={gym?.currency ?? 'USD'}
                defaultAddress={gym?.address ?? null}
                defaultCountry={gym?.country ?? null}
                defaultTimezone={gym?.timezone ?? 'UTC'}
                countries={countries ?? []}
              />
            </div>
            <div className="min-w-0 flex-[999_1_640px]">
              <GymScheduleEditor
                gymSlug={gymSlug}
                gymId={gym?.id ?? ''}
                defaultSchedule={gym?.schedule ?? {}}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-5">
            <div className="min-w-0 flex-[999_1_640px]">
              <AdminsSection initialAdmins={admins} />
            </div>
            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
              <LanguageSwitcher />
              <ChangePasswordForm />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
