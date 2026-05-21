import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { Gym } from '@/types'
import { GymSettingsForm } from './GymSettingsForm'
import { ChangePasswordForm } from './ChangePasswordForm'
import { AdminsSection } from './AdminsSection'
import { getGymAdminsAction } from './actions'
import { Separator } from '@/components/ui/separator'

interface CountryOption { code: string; label: string; timezone: string; utcOffset: string }

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
    <div className="p-8 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Información general del gimnasio</p>
      </div>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">General</h2>
        <GymSettingsForm
          gymSlug={gymSlug}
          gymId={gym?.id ?? ''}
          defaultName={gym?.name ?? ''}
          defaultLogoUrl={gym?.logoUrl ?? null}
          defaultCurrency={gym?.currency ?? 'USD'}
          defaultAddress={gym?.address ?? null}
          defaultCountry={gym?.country ?? null}
          defaultTimezone={gym?.timezone ?? 'UTC'}
          countries={countries ?? []}
        />
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Seguridad</h2>
        <ChangePasswordForm />
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Administradores</h2>
          <p className="text-xs text-zinc-400 mt-1">Usuarios con acceso completo al panel del gimnasio.</p>
        </div>
        <AdminsSection initialAdmins={admins} />
      </section>
    </div>
  )
}
