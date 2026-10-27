import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, Star } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { normalizeLogoUrl } from '@/lib/utils'
import { Gym, Member, Plan, Payment } from '@/types'
import { AdminPage, EmptyState, GymMark, Meter, PageHeader, Panel, PanelLink, Pill, Stat, btn, td, th, type Tone } from '@/components/admin/ui'
import { GymDangerZone, GymEditForm } from './GymEditForm'
import { ResendGymWelcomeButton } from './ResendGymWelcomeButton'
import { CrmChatButton } from './CrmChatButton'
import { SubscriptionSection } from './SubscriptionSection'
import type { SubscriptionInfo, BillingRecord } from '../actions'

interface Props {
  params: Promise<{ id: string }>
}

interface SubscriptionPlan { key: string; label?: string; price: number | string; currency: string; maxMembers?: number | null }
interface PaymentWithMember extends Payment {
  member?: { firstName: string; lastName: string } | null
}
interface PaymentsResponse { data: PaymentWithMember[]; total: number }

const SUB: Record<SubscriptionInfo['subscriptionStatus'], { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Suscripción activa', tone: 'ok' },
  GRACE: { label: 'En prórroga', tone: 'warn' },
  SUSPENDED: { label: 'Suspendida', tone: 'bad' },
}

const METHOD: Record<string, string> = { CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', OTHER: 'Otro' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function GymDetailPage({ params }: Props) {
  // The URL shows the gym slug; old /admin/gyms/<uuid> links redirect to it
  const { id: param } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  if (UUID_RE.test(param)) {
    const byId = await apiFetch<Gym>(`/admin/gyms/${param}`, token, { silent: true })
    if (!byId) notFound()
    redirect(`/admin/gyms/${encodeURIComponent(byId.slug)}`)
  }
  const bySlug = await apiFetch<Gym>(`/gyms/${encodeURIComponent(param)}`, token, { silent: true })
  if (!bySlug) notFound()
  const id = bySlug.id

  const [gym, membersRaw, plansRaw, subscription, billing, subPlans, paymentsRaw] = await Promise.all([
    apiFetch<Gym>(`/admin/gyms/${id}`, token, {
      next: { tags: [`admin-gym-${id}`] },
    }),
    apiFetch<{ data: Member[]; total?: number } | Member[]>(`/members?gymId=${id}&limit=5`, token),
    apiFetch<{ data: Plan[] } | Plan[]>(`/plans?gymId=${id}`, token),
    apiFetch<SubscriptionInfo>(`/admin/gyms/${id}/subscription`, token, {
      next: { tags: [`admin-gym-${id}-subscription`] },
    }),
    apiFetch<BillingRecord[]>(`/admin/gyms/${id}/billing-history`, token),
    apiFetch<SubscriptionPlan[]>(`/admin/subscription-plans`, token, {
      next: { tags: ['admin-subscription-plans'] },
    }),
    apiFetch<PaymentsResponse | PaymentWithMember[]>(`/payments?gymId=${id}&limit=10`, token),
  ])

  if (!gym) notFound()

  const payments: PaymentWithMember[] = paymentsRaw
    ? (Array.isArray(paymentsRaw) ? paymentsRaw : paymentsRaw.data)
    : []
  const gymLogoUrl = normalizeLogoUrl(gym.logoUrl)
  const members: Member[] = membersRaw
    ? (Array.isArray(membersRaw) ? membersRaw : membersRaw.data).slice(0, 5)
    : []
  const memberTotal = membersRaw && !Array.isArray(membersRaw) && typeof membersRaw.total === 'number' ? membersRaw.total : members.length
  const plans: Plan[] = plansRaw ? (Array.isArray(plansRaw) ? plansRaw : plansRaw.data) : []

  const planKey = subscription?.subscriptionPlan ?? gym.subscriptionPlan
  const matchedPlan = subPlans?.find(p => p.key.toUpperCase() === planKey?.toUpperCase())
  const planAmount = matchedPlan ? parseFloat(String(matchedPlan.price)) : null
  const planCurrency = matchedPlan?.currency ?? 'USD'

  const history = [...(billing ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const lastPayment = history[0]
  const now = new Date().getTime()
  const periodStart = lastPayment ? new Date(lastPayment.periodStart).getTime() : 0
  const periodEnd = lastPayment ? new Date(lastPayment.periodEnd).getTime() : 0
  const periodProgress = periodEnd > periodStart ? ((now - periodStart) / (periodEnd - periodStart)) * 100 : null
  const days = subscription?.daysUntilExpiry ?? null
  const status = subscription ? SUB[subscription.subscriptionStatus] : null

  return (
    <AdminPage>
      <PageHeader
        breadcrumb={[{ label: 'Gimnasios', href: '/admin/gyms' }, { label: gym.name }]}
        media={<GymMark name={gym.name} logoUrl={gymLogoUrl} size="lg" />}
        title={gym.name}
        meta={
          <>
            <span className="font-admin-mono">/{gym.slug}</span>
            {gym.country && <><span aria-hidden="true">·</span><span>{gym.country}</span></>}
            {!gym.isActive && <Pill>Inactivo</Pill>}
            {status && <Pill tone={status.tone}>{status.label}</Pill>}
            {matchedPlan && <Pill>{matchedPlan.label ?? matchedPlan.key}</Pill>}
          </>
        }
        actions={
          <>
            {gym.owner && <ResendGymWelcomeButton gymId={id} />}
            <Link href={`/gym/${gym.slug}/dashboard`} className={btn.primary}>
              Entrar al panel
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </>
        }
      />

      <section aria-label="Resumen" className="flex flex-wrap gap-3">
        <Stat
          label="Miembros"
          value={memberTotal}
          hint={matchedPlan?.maxMembers ? `Límite del plan: ${matchedPlan.maxMembers}` : 'Sin límite en su plan'}
        />
        <Stat label="Plan" value={<span className="font-admin text-2xl font-extrabold">{matchedPlan?.label ?? planKey ?? '—'}</span>}>
          {planAmount != null && <p className="mt-1.5 font-admin-mono text-[13px] text-adm-muted">{planCurrency} {planAmount.toLocaleString('es-AR')} / mes</p>}
        </Stat>
        <Stat
          label="Vence"
          value={<span className="text-2xl">{subscription?.subscriptionExpiresAt ? fmtDate(subscription.subscriptionExpiresAt) : '—'}</span>}
          hint={days !== null ? (days >= 0 ? `Quedan ${days} días` : `Venció hace ${-days} días`) : undefined}
          hintTone={days !== null && days <= 7 ? (days < 0 ? 'bad' : 'warn') : 'neutral'}
        >
          {periodProgress !== null && <Meter value={periodProgress} className="mt-2.5" />}
        </Stat>
        <Stat
          label="Último pago"
          value={<span className="text-2xl">{lastPayment ? fmtDate(lastPayment.createdAt) : '—'}</span>}
          hint={lastPayment ? `${METHOD[lastPayment.method] ?? lastPayment.method} · ${lastPayment.currency} ${parseFloat(lastPayment.amount).toLocaleString('es-AR')}` : 'Sin pagos'}
        />
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-4">
          {subscription && (
            <SubscriptionSection
              gymId={id}
              gymSlug={gym.slug}
              subscription={subscription}
              billing={history}
              planAmount={planAmount}
              planCurrency={planCurrency}
              subPlans={subPlans ?? []}
            />
          )}

          <Panel
            title="Pagos de miembros"
            id="mp-h"
            action={<PanelLink href={`/gym/${gym.slug}/memberships`}>Ver membresías</PanelLink>}
          >
            {payments.length === 0 ? (
              <EmptyState>Sin pagos registrados</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th scope="col" className={`${th} pl-5`}>Miembro</th>
                      <th scope="col" className={th}>Fecha</th>
                      <th scope="col" className={th}>Método</th>
                      <th scope="col" className={th}>Notas</th>
                      <th scope="col" className={`${th} pr-5 text-right`}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-adm-subtle">
                        <td className={`${td} pl-5`}>
                          {p.member
                            ? <span className="font-medium">{p.member.firstName} {p.member.lastName}</span>
                            : <span className="font-admin-mono text-xs text-adm-muted">{p.memberId.slice(0, 8)}…</span>}
                        </td>
                        <td className={`${td} font-admin-mono text-[13px]`}>{fmtDate(p.createdAt)}</td>
                        <td className={td}>{METHOD[p.method] ?? p.method}</td>
                        <td className={`${td} max-w-[200px] truncate text-adm-muted`}>{p.notes ?? '—'}</td>
                        <td className={`${td} pr-5 text-right font-admin-mono font-bold`}>
                          {p.currency} {(Number(p.amount) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Miembros recientes"
            id="mem-h"
            action={<PanelLink href={`/gym/${gym.slug}/members`}>{`Ver los ${memberTotal}`}</PanelLink>}
          >
            {members.length === 0 ? (
              <EmptyState>Sin miembros registrados</EmptyState>
            ) : (
              <ul>
                {members.map(m => (
                  <li key={m.id} className="flex items-center gap-3 border-t border-adm-line-soft px-5 py-3 first:border-t-0">
                    <div className="flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-adm-chip text-xs font-extrabold">
                      {m.photoUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={m.photoUrl} alt="" className="size-full object-cover" />
                        : <>{m.firstName[0]}{m.lastName[0]}</>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{m.firstName} {m.lastName}</p>
                      <p className="truncate text-xs text-adm-muted">{m.email}</p>
                    </div>
                    <Pill tone={m.isActive ? 'ok' : 'neutral'}>{m.isActive ? 'Activo' : 'Inactivo'}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <GymEditForm
            gymId={id}
            defaultName={gym.name}
            defaultSlug={gym.slug}
            defaultPlan={gym.subscriptionPlan}
            planOptions={(subPlans ?? []).map(p => ({ key: p.key, label: p.label ?? p.key }))}
            defaultLogoUrl={gymLogoUrl}
            defaultAdvancedReports={gym.advancedReportsEnabled}
            defaultWhatsapp={gym.whatsappPhone ?? null}
            defaultCountry={gym.country ?? null}
            ownerName={gym.owner?.name}
            ownerEmail={gym.owner?.email}
            hasOwner={!!gym.owner}
          />
          <CrmChatButton gymId={gym.id} hasWhatsapp={!!gym.whatsappPhone} />

          <Panel title="Planes que ofrece" id="gp-h" action={<span className="text-[13px] text-adm-muted">{plans.length}</span>} bodyClassName="flex flex-col gap-2 p-4">
            {plans.length === 0 ? (
              <p className="px-1 py-2 text-sm text-adm-muted">Sin planes configurados</p>
            ) : (
              plans.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-adm-line-soft bg-adm-subtle px-3.5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-semibold">
                      {p.name}
                      {p.isFeatured && <Star className="size-3 shrink-0 fill-adm-brand text-adm-warn-fg" aria-label="Destacado" />}
                      {!p.isActive && <Pill>Inactivo</Pill>}
                    </p>
                    <p className="text-xs text-adm-muted">
                      {p.durationDays} días{p.daysPerWeek ? ` · ${p.daysPerWeek}x/sem` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-admin-mono">{p.currency} {p.price.toLocaleString('es-AR')}</span>
                </div>
              ))
            )}
          </Panel>

          <div className="rounded-2xl border border-adm-line bg-adm-surface p-5 text-[13px]">
            <p className="text-adm-muted">ID del gimnasio</p>
            <p className="mt-1 break-all font-admin-mono text-xs">{gym.id}</p>
            <p className="mt-3 text-adm-muted">Creado el {new Date(gym.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            {gym.address && <p className="mt-1 text-adm-muted">{gym.address}</p>}
          </div>

          <GymDangerZone gymId={id} />
        </div>
      </div>
    </AdminPage>
  )
}
