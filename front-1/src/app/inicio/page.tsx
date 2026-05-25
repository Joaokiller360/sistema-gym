import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { Check, Star, Dumbbell, Users, BarChart2, Shield, CreditCard, Zap, ArrowRight, Clock } from 'lucide-react'
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings, type LandingFeature } from '../admin/settings/types'

interface SubscriptionPlan {
  id: string
  key: string
  label: string
  price: number
  currency: string
  maxMembers: number | null
  storeEnabled: boolean
  features: string[]
  isActive: boolean
  sortOrder: number
}

const FEATURE_ICONS = [Dumbbell, Users, BarChart2, Shield, CreditCard, Zap]

function isBenefit(f: string) { return f.startsWith('★') }
function featureText(f: string) { return f.replace(/^★\s*/, '') }

async function getSettings(): Promise<PlatformSettings> {
  const data = await apiFetch<PlatformSettings>('/platform-settings', '', {
    next: { tags: ['platform-settings'] },
  })
  if (!data) return DEFAULT_PLATFORM_SETTINGS
  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...data,
    footerLinks: data.footerLinks ?? [],
    landingFeatures: data.landingFeatures ?? [],
  }
}

async function getPlans(): Promise<SubscriptionPlan[]> {
  try {
    const data = await apiFetch<SubscriptionPlan[]>('/subscription-plans', '', {
      next: { tags: ['admin-subscription-plans'] },
      silent: true,
    })
    if (!data) return []
    return data.filter(p => p.isActive).sort((a, b) => Number(a.price) - Number(b.price))
  } catch {
    return []
  }
}

function NavBar({ saasName, logoUrl, primaryColor }: { saasName: string; logoUrl: string | null; primaryColor: string }) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/inicio" className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0" style={{ background: primaryColor }}>
            {logoUrl
              ? <img src={logoUrl} alt={saasName} className="h-full w-full object-cover" />
              : <Dumbbell className="h-4 w-4 text-black" />
            }
          </div>
          <span className="font-black text-white text-lg">{saasName}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/terminos" className="hidden sm:block text-sm text-white/50 hover:text-white transition-colors px-3 py-2">
            Términos
          </Link>
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-bold transition-all"
            style={{ background: primaryColor, color: '#000' }}
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </nav>
  )
}

function CtaLink({
  href,
  className,
  style,
  children,
}: {
  href: string
  className: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const isExternal = href.startsWith('http')
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {children}
      </a>
    )
  }
  return <Link href={href} className={className} style={style}>{children}</Link>
}

function HeroSection({
  title,
  subtitle,
  ctaText,
  ctaUrl,
  primaryColor,
}: {
  title: string
  subtitle: string
  ctaText: string
  ctaUrl: string
  primaryColor: string
}) {
  return (
    <section className="relative bg-black min-h-screen flex flex-col items-center justify-center px-4 pt-16 overflow-hidden">
      {/* Grid bg */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-20" style={{ background: primaryColor }} />

      <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/60 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: primaryColor }} />
          Plataforma de gestión para gimnasios
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight">
          {title}
        </h1>

        <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <CtaLink
            href={ctaUrl}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-black transition-all hover:scale-105 active:scale-95"
            style={{ background: primaryColor, color: '#000' }}
          >
            {ctaText}
            <ArrowRight className="h-4 w-4" />
          </CtaLink>
          <Link
            href="#planes"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white/70 border border-white/10 hover:border-white/30 hover:text-white transition-all"
          >
            Ver planes
          </Link>
        </div>

        {/* Trust bar */}
        <div className="flex items-center justify-center gap-6 pt-8 flex-wrap">
          {[
            { icon: Shield, text: 'Seguro y confiable' },
            { icon: Clock, text: 'Soporte 24/7' },
            { icon: Zap, text: 'Configuración en minutos' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-xs text-white/40">
              <Icon className="h-3.5 w-3.5" />
              {text}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection({ features, primaryColor }: { features: LandingFeature[]; primaryColor: string }) {
  if (features.length === 0) return null
  return (
    <section className="bg-zinc-50 dark:bg-zinc-900 py-24 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor === '#fffb00' ? '#d97706' : primaryColor }}>
            Características
          </p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Todo lo que necesitás
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Herramientas diseñadas para que gestiones tu gimnasio de forma profesional y eficiente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, i) => {
            const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length]
            return (
              <div key={i} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-3 hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: primaryColor }}>
                  <Icon className="h-5 w-5 text-black" />
                </div>
                <h3 className="font-bold text-base">{feat.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{feat.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function PricingSection({ plans, primaryColor, ctaUrl }: { plans: SubscriptionPlan[]; primaryColor: string; ctaUrl: string }) {
  if (plans.length === 0) return null

  const midIdx = Math.floor(plans.length / 2)

  return (
    <section id="planes" className="bg-white dark:bg-black py-24 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor === '#fffb00' ? '#d97706' : primaryColor }}>
            Precios
          </p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Planes para cada gimnasio
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Desde pequeños estudios hasta grandes cadenas. Elegí el plan que se adapta a tu negocio.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => {
            const featured = i === midIdx && plans.length > 1
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 space-y-5 border-2 transition-all ${featured ? 'border-black dark:border-white shadow-xl scale-105' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'}`}
                style={featured ? { borderColor: primaryColor } : {}}
              >
                {featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-black" style={{ background: primaryColor, color: '#000' }}>
                    Más popular
                  </div>
                )}
                <div className="space-y-1">
                  <h3 className="font-black text-lg">{plan.label}</h3>
                  <p className="text-3xl font-black">
                    {Number(plan.price) === 0
                      ? 'Gratis'
                      : <>{plan.currency} <span>{Number(plan.price).toLocaleString('es-AR')}</span><span className="text-base font-normal text-zinc-400">/mes</span></>
                    }
                  </p>
                  <p className="text-xs text-zinc-400">
                    {plan.maxMembers == null ? 'Miembros ilimitados' : `Hasta ${plan.maxMembers} miembros`}
                  </p>
                </div>

                {plan.storeEnabled && (
                  <p className="text-xs font-bold text-[#1fad9d] bg-[#1fad9d]/10 rounded-full px-2.5 py-1 w-fit">
                    🏪 Tienda incluida
                  </p>
                )}

                <ul className="space-y-2">
                  {(plan.features as string[]).map((f, fi) => (
                    <li key={fi} className={`flex items-start gap-2 text-sm ${isBenefit(f) ? 'font-semibold' : 'text-zinc-600 dark:text-zinc-300'}`}>
                      {isBenefit(f)
                        ? <Star className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" fill="currentColor" />
                        : <Check className="h-3.5 w-3.5 text-[#1fad9d] shrink-0 mt-0.5" />
                      }
                      {featureText(f)}
                    </li>
                  ))}
                </ul>

                <CtaLink
                  href={ctaUrl}
                  className={featured
                    ? 'block w-full text-center rounded-xl py-2.5 text-sm font-bold transition-all'
                    : 'block w-full text-center rounded-xl py-2.5 text-sm font-bold border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-all'
                  }
                  style={featured ? { background: primaryColor, color: '#000' } : {}}
                >
                  {Number(plan.price) === 0 ? 'Comenzar gratis' : 'Comenzar'}
                </CtaLink>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function CtaBanner({ ctaText, ctaUrl, primaryColor, saasName }: { ctaText: string; ctaUrl: string; primaryColor: string; saasName: string }) {
  return (
    <section className="bg-black py-20 px-4">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-black text-white">
          Llevá tu gimnasio al siguiente nivel
        </h2>
        <p className="text-white/50">
          Únete a los gimnasios que ya usan {saasName} para gestionar su negocio de forma profesional.
        </p>
        <CtaLink
          href={ctaUrl}
          className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-black transition-all hover:scale-105 active:scale-95"
          style={{ background: primaryColor, color: '#000' }}
        >
          {ctaText}
          <ArrowRight className="h-4 w-4" />
        </CtaLink>
      </div>
    </section>
  )
}

function LandingFooter({ settings }: { settings: PlatformSettings }) {
  const year = new Date().getFullYear()
  const footerText = settings.footerText || `© ${year} ${settings.saasName}. Todos los derechos reservados.`

  return (
    <footer className="bg-black border-t border-white/10 px-4 py-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-white/90">{footerText}</p>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <Link href="/terminos" className="text-xs text-white/90 hover:text-white/60 transition-colors">
            Términos y condiciones
          </Link>
          {settings.footerLinks.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-white/30 hover:text-white/60 transition-colors">
              {l.label}
            </a>
          ))}
          {settings.footerShowPoweredBy && settings.creatorName && (
            <span className="text-xs text-white/20">
              Desarrollado por{' '}
              {settings.creatorUrl
                ? <a href={settings.creatorUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">{settings.creatorName}</a>
                : settings.creatorName
              }
            </span>
          )}
        </div>
      </div>
    </footer>
  )
}

export default async function LandingPage() {
  const [settings, plans] = await Promise.all([getSettings(), getPlans()])

  const primaryColor = settings.primaryColor || '#fffb00'
  const heroTitle = settings.heroTitle || `Gestión profesional para tu gimnasio`
  const heroSubtitle = settings.heroSubtitle || 'Todo lo que necesitás para administrar tu gimnasio en un solo lugar. Miembros, pagos, reportes y más.'
  const heroCtaText = settings.heroCtaText || 'Comenzar ahora'
  const heroCtaUrl = settings.heroCtaUrl || '/inicio'

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-black">
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
        <CtaBanner ctaText={heroCtaText} ctaUrl={heroCtaUrl} primaryColor={primaryColor} saasName={settings.saasName} />
      </main>
      <LandingFooter settings={settings} />
    </div>
  )
}
