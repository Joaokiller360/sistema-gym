import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { LoginForm } from './LoginForm'
import { Dumbbell } from 'lucide-react'
import Image from 'next/image'

interface PlatformSettings { saasName: string; logoUrl?: string | null }

const BACKEND_URL = (process.env.API_URL ?? 'http://localhost:3001/api/v1').replace(/\/api\/v\d+$/, '')
const resolveLogoUrl = (url: string | null | undefined): string | null => {
  if (!url) return null
  if (url.startsWith('/')) return `${BACKEND_URL}${url}`
  return url
}

const FEATURES = ['Escaneo con Wallet', 'Planes por días', 'Cortes de caja', 'Reportes']

export default async function LoginPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (token) {
    const session = await verifyToken(token)
    if (session) {
      if (session.role === 'SUPER_ADMIN') redirect('/admin/dashboard')
      else if (session.gymSlug) redirect(`/gym/${session.gymSlug}/dashboard`)
    }
  }

  const platform = await apiFetch<PlatformSettings>('/platform-settings', '', {
    next: { tags: ['platform-settings'], revalidate: 300 },
  }).catch(() => null)
  const saasName = platform?.saasName ?? 'GymOS'
  const logoUrl = resolveLogoUrl(platform?.logoUrl)

  return (
    // Always dark, regardless of the app theme
    <main className="font-admin flex min-h-screen flex-col bg-[#0B0B0C] px-6 py-8 text-white">
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[#FFFB00] text-[#0B0B0C]">
              {logoUrl
                ? <Image src={logoUrl} alt="" fill className="object-cover" sizes="44px" />
                : <Dumbbell className="h-[22px] w-[22px]" strokeWidth={2.2} aria-hidden="true" />}
            </span>
            <span className="text-xl font-extrabold tracking-tight">{saasName}</span>
          </div>
          <span className="font-admin-mono text-xs uppercase tracking-[0.08em] text-[#A3A39D]">Panel de gestión</span>
        </header>

        <div className="flex flex-1 flex-wrap items-center justify-between gap-14">
          <section className="flex min-w-0 flex-[999_1_520px] flex-col gap-7">
            <h1 className="text-[clamp(56px,9vw,132px)] font-black uppercase leading-[0.88] tracking-[-0.04em] [font-stretch:125%]">
              Tu gym,<br />
              <span className="text-[#FFFB00]">en orden.</span>
            </h1>
            <p className="max-w-[520px] text-lg leading-normal text-[#C9C9C3]">
              Socios, planes, asistencia, tienda y caja en un solo lugar.
            </p>
            <ul className="flex flex-wrap gap-2">
              {FEATURES.map(f => (
                <li key={f} className="rounded-full border border-[#2A2A2E] px-3.5 py-2 text-[13px] font-semibold text-[#E4E4DF]">
                  {f}
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="login-title"
            className="w-full max-w-[440px] flex-[1_1_380px] rounded-3xl bg-[#FFFFFF] p-7 text-[#111111] sm:p-9"
          >
            <div className="mb-5 space-y-1.5">
              <h2 id="login-title" className="text-[28px] font-black tracking-tight">Iniciar sesión</h2>
              <p className="text-sm text-[#5E5E58]">Ingresá con el correo de tu cuenta.</p>
            </div>
            <LoginForm />
          </section>
        </div>

        <footer className="flex flex-wrap justify-between gap-3 font-admin-mono text-xs text-[#A3A39D]">
          <span>¿Sin acceso? Pedíselo al dueño de tu gimnasio.</span>
          <span>{saasName}</span>
        </footer>
      </div>
    </main>
  )
}
