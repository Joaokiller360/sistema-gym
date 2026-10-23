import { AdminPage, PageHeader, Pill, initials } from '@/components/admin/ui'
import { getAdminProfileAction } from './actions'
import { ProfileInfoForm, AdminChangePasswordForm } from './ProfileForm'

export default async function AdminProfilePage() {
  const profile = await getAdminProfileAction()
  const name = profile?.name ?? ''
  const email = profile?.email ?? ''

  return (
    <AdminPage>
      <PageHeader
        media={
          <div className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-adm-ink text-2xl font-extrabold text-adm-surface">
            {initials(name || email || 'SA')}
          </div>
        }
        title={name || 'Mi perfil'}
        meta={<><span>{email}</span><Pill tone="ok">Super Admin</Pill></>}
      />

      <div className="flex flex-wrap items-start gap-4">
        <section aria-labelledby="info-h" className="min-w-0 flex-[1_1_380px] rounded-2xl border border-adm-line bg-adm-surface p-6">
          <h2 id="info-h" className="text-[17px] font-bold">Información personal</h2>
          <p className="mb-5 mt-0.5 text-[13px] text-adm-muted">Nombre y correo con los que entrás al panel.</p>
          <ProfileInfoForm defaultName={name} defaultEmail={email} />
        </section>

        <section aria-labelledby="sec-h" className="min-w-0 flex-[1_1_380px] rounded-2xl border border-adm-line bg-adm-surface p-6">
          <h2 id="sec-h" className="text-[17px] font-bold">Seguridad</h2>
          <p className="mb-5 mt-0.5 text-[13px] text-adm-muted">Cambiá tu contraseña. Mínimo 6 caracteres.</p>
          <AdminChangePasswordForm />
        </section>
      </div>
    </AdminPage>
  )
}
