import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { Dumbbell, ArrowLeft } from 'lucide-react'
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from '../../admin/settings/types'

async function getSettings(): Promise<PlatformSettings> {
  const data = await apiFetch<PlatformSettings>('/platform-settings', '', {
    next: { tags: ['platform-settings'] },
  })
  if (!data) return DEFAULT_PLATFORM_SETTINGS
  return { ...DEFAULT_PLATFORM_SETTINGS, ...data, footerLinks: data.footerLinks ?? [], landingFeatures: data.landingFeatures ?? [] }
}

function renderContent(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-xl font-black mt-8 mb-3">{line.slice(3)}</h2>)
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-3xl font-black mt-6 mb-4">{line.slice(2)}</h1>)
    } else if (line.startsWith('- ')) {
      elements.push(<li key={key++} className="ml-4 text-zinc-600 dark:text-zinc-300">{line.slice(2)}</li>)
    } else if (line.trim() === '') {
      elements.push(<br key={key++} />)
    } else {
      elements.push(<p key={key++} className="text-zinc-600 dark:text-zinc-300 leading-relaxed">{line}</p>)
    }
  }
  return elements
}

export default async function TermsPage() {
  const settings = await getSettings()
  const primaryColor = settings.primaryColor || '#fffb00'

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/inicio" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0" style={{ background: primaryColor }}>
              {settings.logoUrl
                ? <img src={settings.logoUrl} alt={settings.saasName} className="h-full w-full object-cover" />
                : <Dumbbell className="h-4 w-4 text-black" />
              }
            </div>
            <span className="font-black text-white">{settings.saasName}</span>
          </Link>
          <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-bold transition-all" style={{ background: primaryColor, color: '#000' }}>
            Iniciar sesión
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Link href="/inicio" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>

        {settings.termsContent ? (
          <div className="prose-sm max-w-none space-y-1">
            {renderContent(settings.termsContent)}
          </div>
        ) : (
          <div className="text-center py-24 space-y-3">
            <p className="text-4xl">📄</p>
            <h1 className="text-2xl font-black">Términos y condiciones</h1>
            <p className="text-zinc-400">El contenido aún no fue configurado.</p>
            <p className="text-sm text-zinc-400">
              El administrador puede editarlo desde{' '}
              <span className="font-semibold">Panel → Configuración → Términos y condiciones</span>.
            </p>
          </div>
        )}
      </div>

      <footer className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-6 mt-12">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-zinc-400 text-center">
            {settings.footerText || `© ${new Date().getFullYear()} ${settings.saasName}. Todos los derechos reservados.`}
          </p>
        </div>
      </footer>
    </div>
  )
}
