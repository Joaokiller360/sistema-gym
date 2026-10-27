'use server'

import { Suspense } from 'react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { QrCode, UserPlus, LogIn } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { verifyToken } from '@/lib/auth'
import { Member, Class, Gym } from '@/types'
import { AdminPage, EmptyState, PageHeader, Panel, PanelLink, PersonMark, Pill, SectionLabel, Stat, btn, type Tone } from '@/components/admin/ui'
import { NewMemberModal } from '../members/NewMemberModal'
import { AdvancedReportsSection, type AdvancedReport } from './AdvancedReportsSection'
import { QuickCheckInModal } from './QuickCheckInModal'
import { dashboardMessages } from './messages'
import { getIntlLocale, getT } from '@/i18n/server'

interface MembersResponse { data: Member[]; total: number }
interface FinancialReport { totalRevenue: number; currency: string }
interface AttendanceWithMember {
  id: string
  checkIn: string
  checkOut: string | null
  memberId: string
  member?: { id: string; firstName: string; lastName: string } | null
}
interface PendingCredit { memberId: string; quantity: number; unitPrice: number }
interface DailyCut { salesCount: number; total: number }

interface Props {
  params: Promise<{ gymSlug: string }>
  searchParams: Promise<{ new?: string; modal?: string }>
}

function gymDayBoundsISO(dateStr: string, tz: string): { start: string; end: string } {
  const [year, month, day] = dateStr.split('-').map(Number)
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(noonUTC)
  const g = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0')
  const localNoonUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'))
  const offsetMs = noonUTC.getTime() - localNoonUTC
  return {
    start: new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + offsetMs).toISOString(),
    end:   new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) + offsetMs).toISOString(),
  }
}

function AttentionCard({ href, count, label, tag, tone }: { href: string; count: React.ReactNode; label: string; tag?: string; tone: Tone }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 flex-1 basis-48 flex-col gap-1.5 rounded-xl border border-adm-line bg-adm-surface px-4.5 py-4 transition-colors hover:border-adm-ink"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-admin-mono text-[28px] font-bold leading-none">{count}</span>
        {tag && <Pill tone={tone}>{tag}</Pill>}
      </div>
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  )
}

export default async function GymDashboardPage({ params, searchParams }: Props) {
  const { gymSlug } = await params
  const { new: newParam, modal } = await searchParams
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const [t, intl] = await Promise.all([getT(dashboardMessages), getIntlLocale()])

  const session = await verifyToken(token)
  const isSuperAdmin = session?.role === 'SUPER_ADMIN'
  const canScan = ['SUPER_ADMIN', 'GYM_OWNER', 'GYM_ADMIN', 'RECEPTIONIST'].includes(session?.role ?? '')

  const gymHeader = { headers: { 'x-gym-slug': gymSlug } }

  const [gym, gymStatus] = await Promise.all([
    apiFetch<Gym>(`/gyms/${gymSlug}`, token),
    apiFetch<{ timezone: string; localTime: string; isOpen: boolean }>(`/gyms/${gymSlug}/status`, token),
  ])

  const tz = gymStatus?.timezone ?? 'UTC'
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz })
  const monthStr = todayStr.slice(0, 7) + '-01'
  const in3DaysStr = new Date(now.getTime() + 3 * 86400000).toLocaleDateString('en-CA', { timeZone: tz })

  const gymIdParam = isSuperAdmin && gym ? `&gymId=${gym.id}` : ''
  const advancedEnabled = gym?.advancedReportsEnabled ?? false
  const storeEnabled = gym?.storeEnabled ?? false
  const dayBounds = gymDayBoundsISO(todayStr, tz)

  const [membersRaw, attendanceRaw, classes, financial, advancedReport, expiringRaw, pendingCredits, dailyCut] = await Promise.all([
    apiFetch<MembersResponse | Member[]>(`/members?status=active&limit=5`, token, gymHeader),
    apiFetch<AttendanceWithMember[]>(`/attendance?startDate=${dayBounds.start}&endDate=${dayBounds.end}`, token, gymHeader),
    apiFetch<Class[]>(`/classes`, token, gymHeader),
    apiFetch<FinancialReport>(`/reports/financial?startDate=${monthStr}${gymIdParam}`, token, gymHeader),
    advancedEnabled
      ? apiFetch<AdvancedReport>(`/reports/advanced?startDate=${monthStr}&endDate=${todayStr}`, token, gymHeader)
      : Promise.resolve(null),
    apiFetch<unknown[]>(`/memberships?status=ACTIVE&endsAfter=${todayStr}&endsBefore=${in3DaysStr}`, token, gymHeader),
    storeEnabled ? apiFetch<PendingCredit[]>(`/store/credits`, token, { ...gymHeader, silent: true }) : Promise.resolve(null),
    storeEnabled ? apiFetch<DailyCut>(`/store/cuts/daily?date=${todayStr}`, token, { ...gymHeader, silent: true }) : Promise.resolve(null),
  ])

  const activeMembers = membersRaw ? (Array.isArray(membersRaw) ? membersRaw.length : membersRaw.total) : 0
  const attendance = attendanceRaw ?? []
  const insideNow = attendance.filter(a => !a.checkOut).length
  const activeClasses = classes?.filter(c => c.isActive).length ?? 0
  const monthRevenue = financial?.totalRevenue ?? 0
  const currency = financial?.currency ?? gym?.currency ?? 'USD'
  const recentMembers: Member[] = membersRaw ? (Array.isArray(membersRaw) ? membersRaw : membersRaw.data).slice(0, 5) : []
  const expiringCount = Array.isArray(expiringRaw) ? expiringRaw.length : 0

  const credits = pendingCredits ?? []
  const creditTotal = credits.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0)
  const creditMembers = new Set(credits.map(c => c.memberId)).size

  // Check-ins per hour (gym local time), 6 to 23 h
  const hourOf = (iso: string) => Number(new Date(iso).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: tz })) % 24
  const hours = Array.from({ length: 18 }, (_, i) => i + 6)
  const perHour = hours.map(h => attendance.filter(a => hourOf(a.checkIn) === h).length)
  const maxHour = Math.max(1, ...perHour)
  const currentHour = hourOf(now.toISOString())

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit', timeZone: tz })

  return (
    <div className="admin-shell min-h-full">
      <AdminPage>
        <PageHeader
          eyebrow={<span className="capitalize">{now.toLocaleDateString(intl, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })}</span>}
          title={gym?.name ?? 'Dashboard'}
          meta={
            gymStatus ? (
              <>
                <Pill tone={gymStatus.isOpen ? 'ok' : 'neutral'}>{gymStatus.isOpen ? t.openNow : t.closed}</Pill>
                <span>{t.localTime(gymStatus.localTime)}</span>
              </>
            ) : undefined
          }
          actions={
            <>
              <Link href="?new=member" className={btn.line}>
                <UserPlus className="size-4" aria-hidden="true" /> {t.newMember}
              </Link>
              <Link href="?modal=checkin" className={btn.line}>
                <LogIn className="size-4" aria-hidden="true" /> {t.manualCheckIn}
              </Link>
              {canScan && (
                <Link href="attendance/scan" className={btn.primary}>
                  <QrCode className="size-4" aria-hidden="true" /> {t.scanQr}
                </Link>
              )}
            </>
          }
        />

        <section aria-labelledby="attn-h" className="flex flex-col gap-2.5">
          <SectionLabel id="attn-h">{t.today}</SectionLabel>
          <div className="flex flex-wrap gap-3">
            <AttentionCard href="attendance" count={insideNow} label={t.insideNow} tag={insideNow > 0 ? t.live : undefined} tone="ok" />
            <AttentionCard
              href="members?status=expiring"
              count={expiringCount}
              label={t.expiring3}
              tag={expiringCount > 0 ? t.review : undefined}
              tone="warn"
            />
            {storeEnabled && (
              <AttentionCard
                href="store"
                count={<span className="text-[24px]">${creditTotal.toLocaleString(intl)}</span>}
                label={`${t.pendingCredit}${creditMembers ? ` · ${t.creditMembers(creditMembers)}` : ''}`}
                tag={credits.length > 0 ? t.items(credits.length) : undefined}
                tone="high"
              />
            )}
          </div>
        </section>

        <section aria-label={t.indicators} className="flex flex-wrap gap-3">
          <Stat label={t.activeMembers} value={activeMembers.toLocaleString(intl)} />
          <Stat label={t.monthRevenue} unit={currency} value={(monthRevenue / 100).toLocaleString(intl)} />
          <Stat label={t.attendanceToday} value={attendance.length} hint={insideNow > 0 ? t.insideCount(insideNow) : undefined} hintTone="ok" />
          {storeEnabled ? (
            <Stat label={t.storeSalesToday} value={`$${(dailyCut?.total ?? 0).toLocaleString(intl)}`} hint={t.sales(dailyCut?.salesCount ?? 0)} />
          ) : (
            <Stat label={t.activeClasses} value={activeClasses} />
          )}
        </section>

        <section aria-labelledby="hours-h" className="rounded-2xl border border-adm-line bg-adm-night p-6 text-white">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="hours-h" className="text-[15px] font-bold">{t.perHour}</h2>
              <p className="mt-1 text-[13px] text-[#a3a39d]">{t.perHourSub}</p>
            </div>
            <span className="font-admin-mono text-[13px] text-[#a3a39d]">{t.entries(attendance.length)}</span>
          </div>
          <div className="mt-6 flex h-[140px] items-end gap-1.5 border-b border-[#2a2a2c]" role="img" aria-label={t.perHourAria(attendance.length)}>
            {perHour.map((n, i) => (
              <div key={hours[i]} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${hours[i]} h: ${n}`}>
                {n > 0 && <span className="font-admin-mono text-[10px] text-[#a3a39d]">{n}</span>}
                <div
                  className={hours[i] === currentHour ? 'w-full max-w-7 rounded-t bg-adm-brand' : 'w-full max-w-7 rounded-t bg-[#3a3a3d]'}
                  style={{ height: `${n > 0 ? Math.max(4, (n / maxHour) * 85) : 2}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {hours.map(h => (
              <div key={h} className="min-w-0 flex-1 text-center font-admin-mono text-[10px] text-[#85857f]">{h % 3 === 0 ? h : ''}</div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Panel title={t.todayAttendance} id="att-h" action={<PanelLink href="attendance">{t.seeAll}</PanelLink>} className="min-w-0 flex-[1_1_380px]">
            {attendance.length === 0 ? (
              <EmptyState>{t.noRecordsToday}</EmptyState>
            ) : (
              <ul>
                {attendance.slice(0, 6).map(a => {
                  const name = a.member ? `${a.member.firstName} ${a.member.lastName}` : a.memberId.slice(0, 8) + '…'
                  return (
                    <li key={a.id} className="flex items-center gap-3 border-t border-adm-line-soft px-5 py-3 first:border-t-0">
                      <PersonMark name={name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{name}</p>
                        <p className="font-admin-mono text-xs text-adm-muted">{fmtTime(a.checkIn)}{a.checkOut ? ` → ${fmtTime(a.checkOut)}` : ''}</p>
                      </div>
                      <Pill tone={a.checkOut ? 'neutral' : 'ok'}>{a.checkOut ? t.left : t.inside}</Pill>
                    </li>
                  )
                })}
                {attendance.length > 6 && (
                  <li className="border-t border-adm-line-soft py-2.5 text-center text-xs text-adm-muted">{t.more(attendance.length - 6)}</li>
                )}
              </ul>
            )}
          </Panel>

          <Panel title={t.latestMembers} id="mem-h" action={<PanelLink href="members">{t.seeAllMembers}</PanelLink>} className="min-w-0 flex-[1_1_380px]">
            {recentMembers.length === 0 ? (
              <EmptyState>{t.noMembers}</EmptyState>
            ) : (
              <ul>
                {recentMembers.map(m => (
                  <li key={m.id}>
                    <Link href={`members?member=${m.id}`} className="flex items-center gap-3 border-t border-adm-line-soft px-5 py-3 transition-colors hover:bg-adm-subtle">
                      <PersonMark name={`${m.firstName} ${m.lastName}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{m.firstName} {m.lastName}</p>
                        <p className="truncate text-xs text-adm-muted">{m.email}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {advancedEnabled && <AdvancedReportsSection gymSlug={gymSlug} data={advancedReport} />}

        {newParam === 'member' && (
          <Suspense>
            <NewMemberModal gymSlug={gymSlug} />
          </Suspense>
        )}

        {modal === 'checkin' && (
          <Suspense>
            <QuickCheckInModal gymSlug={gymSlug} />
          </Suspense>
        )}
      </AdminPage>
    </div>
  )
}
