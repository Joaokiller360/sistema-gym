import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { LoginForm } from './LoginForm'
import { Dumbbell } from 'lucide-react'

export default async function LoginPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (token) {
    const session = await verifyToken(token)
    if (session) {
      if (session.role === 'SUPER_ADMIN') redirect('/admin/dashboard')
      else redirect(`/gym/${session.gymSlug}/dashboard`)
    }
  }

  return (
    <main className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — brand */}
      <div className="flex flex-col items-center justify-center bg-black px-8 py-12 lg:w-1/2 lg:sticky lg:top-0 lg:h-screen">
        <div className="w-full max-w-xs text-center lg:text-left">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#fffb00] mb-6">
            <Dumbbell className="h-7 w-7 text-black" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight">GymOS</h1>
          <p className="mt-3 text-white/50 text-base leading-relaxed">
            Gestión profesional para tu gimnasio. Miembros, planes, asistencia y más en un solo lugar.
          </p>
          <div className="mt-10 space-y-3 hidden lg:block">
            {[
              'Gestión de miembros y membresías',
              'Control de asistencia en tiempo real',
              'Reportes financieros y retención',
              'Marketing y comunicaciones',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-sm text-white/60">
                <span className="w-5 h-5 rounded-full bg-[#1fad9d] flex items-center justify-center shrink-0">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-zinc-50 lg:bg-white">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <h2 className="text-2xl font-black tracking-tight">Iniciar sesión</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Ingresá tus credenciales para continuar
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm lg:shadow-none lg:border-0 lg:p-0">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  )
}
