import Link from 'next/link'
import Image from 'next/image'
import { apiFetch } from '@/lib/api'
import {
  Dumbbell, Users, BarChart2, Shield,
  CreditCard, Zap, ArrowRight, ChevronRight, Package,
  Calendar, TrendingUp, Bell,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings, type LandingFeature } from './admin/settings/types'
import { PricingSection, type SubscriptionPlanPublic } from './PricingSection'
import { AccessRequestBanner } from './AccessRequestBanner'

const FEATURE_ICONS = [Dumbbell, Users, BarChart2, Shield, CreditCard, Zap, Package, Calendar, TrendingUp, Bell]

const BACKEND_URL = (process.env.API_URL ?? 'http://localhost:3001/api/v1').replace(/\/api\/v\d+$/, '')
const resolveLogoUrl = (url: string | null | undefined): string | null => {
  if (!url) return null
  if (url.startsWith('/')) return `${BACKEND_URL}${url}`
  return url
}

async function getSettings(): Promise<PlatformSettings> {
  const data = await apiFetch<PlatformSettings>('/platform-settings', '', {
    next: { tags: ['platform-settings'], revalidate: 300 },
  })
  if (!data) return DEFAULT_PLATFORM_SETTINGS
  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...data,
    logoUrl: resolveLogoUrl(data.logoUrl),
    footerLinks: data.footerLinks ?? [],
    landingFeatures: data.landingFeatures ?? [],
    availableSlots: data.availableSlots ?? [],
  }
}

async function getPlans(): Promise<SubscriptionPlanPublic[]> {
  try {
    const data = await apiFetch<SubscriptionPlanPublic[]>('/subscription-plans', '', {
      next: { tags: ['admin-subscription-plans'], revalidate: 300 },
      silent: true,
    })
    if (!data) return []
    return data.filter(p => p.isActive).sort((a, b) => Number(a.price) - Number(b.price))
  } catch {
    return []
  }
}

function NavBar({ saasName, logoUrl, primaryColor }: {
  saasName: string; logoUrl: string | null; primaryColor: string
}) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-zinc-200/60 dark:border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0 relative" style={{ background: primaryColor }}>
            {logoUrl
              ? <Image src={logoUrl} alt={saasName} fill className="object-cover" sizes="32px" />
              : <Dumbbell className="h-4 w-4 text-black" />
            }
          </div>
          <span className="font-black text-zinc-900 dark:text-white text-lg tracking-tight">{saasName}</span>
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          <Link href="#caracteristicas" className="text-sm text-zinc-500 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white/80 transition-colors px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5">
            Características
          </Link>
          <Link href="#planes" className="text-sm text-zinc-500 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white/80 transition-colors px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5">
            Precios
          </Link>
          <Link href="/terminos" className="text-sm text-zinc-500 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white/80 transition-colors px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/5">
            Términos
          </Link>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden sm:flex items-center gap-1 text-sm text-zinc-600 dark:text-white/60 hover:text-zinc-900 dark:hover:text-white transition-colors px-3 py-2"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all hover:opacity-90 active:scale-95"
            style={{ background: primaryColor, color: '#000' }}
          >
            Empezar gratis
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </nav>
  )
}

function CtaLink({
  href, className, style, children,
}: {
  href: string; className: string; style?: React.CSSProperties; children: React.ReactNode
}) {
  if (href.startsWith('http')) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>{children}</a>
  }
  return <Link href={href} className={className} style={style}>{children}</Link>
}

function HeroSection({ title, subtitle, ctaText, ctaUrl, primaryColor }: {
  title: string; subtitle: string; ctaText: string; ctaUrl: string; primaryColor: string
}) {
  const words = title.split(' ')
  const half = Math.ceil(words.length / 2)
  const line1 = words.slice(0, half).join(' ')
  const line2 = words.slice(half).join(' ')

  return (
    <section className="relative bg-zinc-50 dark:bg-black min-h-screen flex flex-col items-center justify-center px-4 pt-16 pb-0 overflow-hidden">
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:3rem_3rem]" />
      {/* Fade edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,transparent_0%,rgba(244,244,245,0.7)_100%)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,transparent_0%,rgba(0,0,0,0.7)_100%)]" />
      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-zinc-50 dark:from-black to-transparent z-10" />

      {/* Glows */}
      <div
        className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[160px] opacity-20 dark:opacity-15"
        style={{ background: primaryColor }}
      />
      <div className="absolute top-[30%] left-[20%] w-[300px] h-[300px] rounded-full blur-[100px] opacity-10 bg-blue-400 dark:bg-blue-500" />
      <div className="absolute top-[35%] right-[15%] w-[250px] h-[250px] rounded-full blur-[100px] opacity-10 bg-purple-400 dark:bg-purple-500" />

      <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8 py-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-300/60 dark:border-white/10 bg-zinc-100/60 dark:bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-zinc-500 dark:text-white/50 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: primaryColor }} />
          Plataforma de gestión para gimnasios
        </div>

        {/* Headline */}
        <div className="space-y-1">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-zinc-900 dark:text-white leading-[1.05] tracking-tight">
            {line1}
          </h1>
          <h1 className="landing-h1-gradient text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight bg-clip-text text-transparent">
            {line2}
          </h1>
        </div>

        <p className="text-lg sm:text-xl text-zinc-500 dark:text-white/40 max-w-2xl mx-auto leading-relaxed font-light">
          {subtitle}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <CtaLink
            href={ctaUrl}
            className="inline-flex items-center gap-2.5 rounded-2xl px-7 py-3.5 text-base font-black transition-all hover:scale-105 hover:opacity-95 active:scale-95 shadow-lg"
            style={{ background: primaryColor, color: '#000', boxShadow: `0 0 40px ${primaryColor}40` }}
          >
            {ctaText}
            <ArrowRight className="h-4 w-4" />
          </CtaLink>
          <Link
            href="#planes"
            className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-base font-semibold text-zinc-600 dark:text-white/60 border border-zinc-300 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20 hover:text-zinc-900 dark:hover:text-white/90 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-all"
          >
            Ver planes
          </Link>
        </div>

        {/* Trust chips */}
        <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
          {[
            { icon: Shield, text: 'Sin contratos' },
            { icon: Zap, text: 'Listo en minutos' },
            { icon: CreditCard, text: 'Cancela cuando quieras' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-white/30 bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] rounded-full px-3 py-1.5">
              <Icon className="h-3 w-3" />
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      <div className="relative z-20 w-full max-w-4xl mx-auto mb-0">
        <div className="grid grid-cols-3 divide-x divide-zinc-200 dark:divide-white/[0.06] border border-zinc-200 dark:border-white/[0.06] rounded-2xl bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm mx-4 sm:mx-0 shadow-sm dark:shadow-none">
          {[
            { value: '10+', label: 'Módulos integrados' },
            { value: '4', label: 'Roles de acceso' },
            { value: '24/7', label: 'Soporte incluido' },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center py-6 px-4 gap-1">
              <span className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">{value}</span>
              <span className="text-xs text-zinc-400 dark:text-white/30 text-center leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-16" />
    </section>
  )
}

function FeaturesSection({ features, primaryColor }: { features: LandingFeature[]; primaryColor: string }) {
  if (features.length === 0) return null

  const accentColor = primaryColor === '#fffb00' ? '#d97706' : primaryColor

  return (
    <section id="caracteristicas" className="bg-zinc-100 dark:bg-zinc-950 py-28 px-4">
      <div className="max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: accentColor }}>
            Características
          </p>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-zinc-900 dark:text-white leading-tight">
            Todo lo que tu gimnasio necesita
          </h2>
          <p className="text-zinc-500 dark:text-white/40 leading-relaxed">
            Herramientas diseñadas para gestionar tu negocio de forma profesional, desde cualquier dispositivo.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feat, i) => {
            const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length]
            const isLarge = i === 0
            return (
              <div
                key={i}
                className={`group relative rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-6 hover:border-zinc-300 dark:hover:border-white/[0.12] hover:shadow-md dark:hover:bg-white/[0.05] transition-all duration-300 overflow-hidden ${isLarge ? 'lg:col-span-2' : ''}`}
              >
                <div
                  className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-15 dark:group-hover:opacity-20 transition-opacity duration-500"
                  style={{ background: primaryColor }}
                />
                <div className="relative z-10 space-y-4">
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${primaryColor}18`, border: `1px solid ${primaryColor}30` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: accentColor }} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-zinc-900 dark:text-white text-base">{feat.title}</h3>
                    <p className="text-sm text-zinc-500 dark:text-white/40 leading-relaxed">{feat.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}


function CtaBanner({ ctaText, ctaUrl, primaryColor, saasName }: {
  ctaText: string; ctaUrl: string; primaryColor: string; saasName: string
}) {
  return (
    <section className="relative bg-zinc-900 dark:bg-zinc-950 py-28 px-4 overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[160px] opacity-20"
        style={{ background: primaryColor }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:3rem_3rem]" />

      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">Empezá hoy</p>
          <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight">
            Tu gimnasio merece herramientas profesionales
          </h2>
          <p className="text-white/40 max-w-xl mx-auto leading-relaxed">
            Únete a los gimnasios que ya usan {saasName} para gestionar su negocio de forma más eficiente.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <CtaLink
            href={ctaUrl}
            className="inline-flex items-center gap-2.5 rounded-2xl px-8 py-4 text-base font-black transition-all hover:scale-105 active:scale-95"
            style={{ background: primaryColor, color: '#000', boxShadow: `0 0 60px ${primaryColor}30` }}
          >
            {ctaText}
            <ArrowRight className="h-4 w-4" />
          </CtaLink>
          <Link href="#planes" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors px-4 py-4">
            Ver planes →
          </Link>
        </div>
      </div>
    </section>
  )
}

function LandingFooter({ settings }: { settings: PlatformSettings }) {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-zinc-100 dark:bg-black border-t border-zinc-200 dark:border-white/[0.06] px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <span className="font-black text-zinc-900 dark:text-white text-sm">{settings.saasName}</span>
            <p className="text-xs text-zinc-400 dark:text-white/20">
              {settings.footerText || `© ${year} ${settings.saasName}. Todos los derechos reservados.`}
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link href="/terminos" className="text-xs text-zinc-400 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white/60 transition-colors">
              Términos y condiciones
            </Link>
            {settings.footerLinks.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white/60 transition-colors">
                {l.label}
              </a>
            ))}
            {settings.footerShowPoweredBy && settings.creatorName && (
              <span className="text-xs text-zinc-400 dark:text-white/20">
                Desarrollado por{' '}
                {settings.creatorUrl
                  ? <a href={settings.creatorUrl} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-600 dark:hover:text-white/40 transition-colors">{settings.creatorName}</a>
                  : settings.creatorName
                }
              </span>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default async function LandingPage() {
  const [settings, plans] = await Promise.all([getSettings(), getPlans()])

  const primaryColor = settings.primaryColor || '#fffb00'
  const heroTitle = settings.heroTitle || 'Gestión profesional para tu gimnasio'
  const heroSubtitle = settings.heroSubtitle || 'Todo lo que necesitás para administrar tu gimnasio en un solo lugar. Miembros, pagos, reportes y más.'
  const heroCtaText = settings.heroCtaText || 'Comenzar gratis'
  const heroCtaUrl = settings.heroCtaUrl || '/login'

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ '--pc': primaryColor } as React.CSSProperties}
    >
      <NavBar saasName={settings.saasName} logoUrl={settings.logoUrl} primaryColor={primaryColor} />
      <main className="flex-1">
        <HeroSection
          title={heroTitle}
          subtitle={heroSubtitle}
          ctaText={heroCtaText}
          ctaUrl={heroCtaUrl}
          primaryColor={primaryColor}
        />
        <FeaturesSection features={settings.landingFeatures} primaryColor={primaryColor} />
        {settings.landingShowPlans && plans.length > 0 && (
          <PricingSection plans={plans} primaryColor={primaryColor} ctaUrl={heroCtaUrl} />
        )}
        <AccessRequestBanner primaryColor={primaryColor} availableSlots={settings.availableSlots ?? []} />
        <CtaBanner ctaText={heroCtaText} ctaUrl={heroCtaUrl} primaryColor={primaryColor} saasName={settings.saasName} />
      </main>
      <LandingFooter settings={settings} />
    </div>
  )
}
