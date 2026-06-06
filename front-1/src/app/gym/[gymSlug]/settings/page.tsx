import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Gym } from '@/types'
import { GymSettingsForm } from './GymSettingsForm'
import { ChangePasswordForm } from './ChangePasswordForm'
import { AdminsSection } from './AdminsSection'
import { GymScheduleEditor } from './GymScheduleEditor'
import { getGymAdminsAction } from './actions'
import { Building2, Lock, Users, Clock, Globe, BadgeCheck } from 'lucide-react'

interface CountryOption { code: string; label: string; timezone: string; utcOffset: string }

const resolveLogoUrl = (url: string | null | undefined): string | null =>
  url ? url.replace(/^https?:\/\/[^/]+/, '') : null

function SectionHeader({ icon: Icon, title, description }: {
  icon: React.ElementType; title: string; description: string
}) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-zinc-100">
      <div className="h-9 w-9 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-zinc-500" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-zinc-800">{title}</h2>
        <p className="text-xs text-zinc-400">{description}</p>
      </div>
    </div>
  )
}

interface Props {
  params: Promise<{ gymSlug: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''

  const [gym, admins, countries] = await Promise.all([
    apiFetch<Gym>(`/gyms/${gymSlug}`, token, { next: { tags: [`gym-${gymSlug}`] } }),
    getGymAdminsAction(),
    apiFetch<CountryOption[]>('/gyms/countries', token, { next: { revalidate: 86400 } }),
  ])

  const logoUrl = resolveLogoUrl(gym?.logoUrl)
  const initials = (gym?.name ?? 'G').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Ajustes generales, horarios y accesos del gimnasio</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── Left column (2/3) ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* General */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
            <SectionHeader icon={Building2} title="General" description="Nombre, logo, dirección y moneda" />
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

          {/* Schedule */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
            <SectionHeader icon={Clock} title="Horario del gimnasio" description="Días y horas de apertura" />
            <GymScheduleEditor
              gymSlug={gymSlug}
              gymId={gym?.id ?? ''}
              defaultSchedule={(gym?.schedule as any) ?? {}}
            />
          </div>

        </div>

        {/* ── Right column (1/3) ── */}
        <div className="space-y-6">

          {/* Gym summary card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  : <span className="text-sm font-black text-black">{initials}</span>
                }
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-zinc-800 truncate">{gym?.name ?? '—'}</p>
                <p className="text-xs text-zinc-400 truncate">/{gymSlug}</p>
              </div>
            </div>
            <div className="space-y-2 border-t border-zinc-100 pt-3">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Globe className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span className="truncate">{gym?.timezone ?? 'UTC'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span className="capitalize">{gym?.subscriptionPlan?.toLowerCase() ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Seguridad */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
            <SectionHeader icon={Lock} title="Seguridad" description="Cambiar contraseña" />
            <ChangePasswordForm />
          </div>

          {/* Administradores */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
            <SectionHeader icon={Users} title="Administradores" description="Acceso completo al panel" />
            <AdminsSection initialAdmins={admins} />
          </div>

        </div>
      </div>
    </div>
  )
}
