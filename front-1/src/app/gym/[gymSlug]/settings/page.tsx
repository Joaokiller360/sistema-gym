import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Gym } from '@/types'
import { GymSettingsForm } from './GymSettingsForm'
import { ChangePasswordForm } from './ChangePasswordForm'
import { AdminsSection } from './AdminsSection'
import { getGymAdminsAction } from './actions'
import { Building2, Lock, Users } from 'lucide-react'

interface CountryOption { code: string; label: string; timezone: string; utcOffset: string }

const resolveLogoUrl = (url: string | null | undefined): string | null =>
  url ? url.replace(/^https?:\/\/[^/]+/, '') : null

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

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Información general y accesos del gimnasio</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* General — 2/3 */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6 space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold">General</h2>
              <p className="text-xs text-zinc-400">Nombre, logo, dirección y moneda</p>
            </div>
          </div>
          <GymSettingsForm
            gymSlug={gymSlug}
            gymId={gym?.id ?? ''}
            defaultName={gym?.name ?? ''}
            defaultLogoUrl={resolveLogoUrl(gym?.logoUrl)}
            defaultCurrency={gym?.currency ?? 'USD'}
            defaultAddress={gym?.address ?? null}
            defaultCountry={gym?.country ?? null}
            defaultTimezone={gym?.timezone ?? 'UTC'}
            countries={countries ?? []}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Seguridad */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4 text-zinc-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Seguridad</h2>
                <p className="text-xs text-zinc-400">Cambiar contraseña</p>
              </div>
            </div>
            <ChangePasswordForm />
          </div>

          {/* Administradores */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-zinc-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold">Administradores</h2>
                <p className="text-xs text-zinc-400">Acceso completo al panel</p>
              </div>
            </div>
            <AdminsSection initialAdmins={admins} />
          </div>
        </div>
      </div>
    </div>
  )
}
