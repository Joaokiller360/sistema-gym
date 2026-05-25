import { getAdminProfileAction } from './actions'
import { ProfileInfoForm, AdminChangePasswordForm } from './ProfileForm'
import { UserCircle, Lock } from 'lucide-react'

export default async function AdminProfilePage() {
  const profile = await getAdminProfileAction()

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Nombre, correo y contraseña de tu cuenta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Info */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
              <UserCircle className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Información personal</h2>
              <p className="text-xs text-zinc-400">Nombre y correo electrónico</p>
            </div>
          </div>
          <ProfileInfoForm
            defaultName={profile?.name ?? ''}
            defaultEmail={profile?.email ?? ''}
          />
        </div>

        {/* Password */}
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
          <AdminChangePasswordForm />
        </div>
      </div>
    </div>
  )
}
