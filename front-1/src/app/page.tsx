import Link from 'next/link'
import Image from 'next/image'
import { apiFetch } from '@/lib/api'
import { Dumbbell } from 'lucide-react'
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from './admin/settings/types'
import { PricingSection, type SubscriptionPlanPublic } from './PricingSection'
import { AccessRequestBanner } from './AccessRequestBanner'
import { HeroWords } from './_landing/HeroWords'
import { LiveCheckins } from './_landing/LiveCheckins'
import { ModuleTabs, type LandingModule } from './_landing/ModuleTabs'
import s from './_landing/landing.module.css'

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

// Shown until features are set in admin › settings; the rows are sample data for the illustration
const DEFAULT_MODULES: LandingModule[] = [
  {
    title: 'Socios y membresías',
    headline: 'Cada socio con su plan, su estado y su historial.',
    desc: 'Altas en segundos, importación desde Excel, congelamientos y vencimientos con aviso automático por email.',
    rows: [['Sofía Vera · Mensual libre', 'Activa', '#5FD4C4'], ['Juan Pérez · Trimestral', 'Vence en 2 días', 'var(--acc)'], ['Ana López · Funcional 3x', 'Congelada', '#8AB4FF']],
  },
  {
    title: 'Check-in con QR',
    headline: 'La puerta sabe quién está al día.',
    desc: 'Cada socio entra con su QR. Si la membresía venció, recepción lo ve al instante y puede cobrar en el momento.',
    rows: [['07:02 · Nicolás Ruiz', 'Acceso OK', '#5FD4C4'], ['07:05 · Mía Castro', 'Acceso OK', '#5FD4C4'], ['07:09 · Tomás Benítez', 'Plan vencido', '#FF8A80']],
  },
  {
    title: 'Clases y entrenadores',
    headline: 'Grilla de clases sin cruces ni sobrecupos.',
    desc: 'Armá la semana, asigná entrenadores y controlá la asistencia de cada clase.',
    rows: [['Lun 08:00 · Funcional', '18 / 20', 'var(--acc)'], ['Lun 19:00 · Spinning', '20 / 20', '#FF8A80'], ['Mar 18:00 · Cross', '9 / 16', '#5FD4C4']],
  },
  {
    title: 'Tienda e inventario',
    headline: 'Vendé suplementos y merch desde el mismo panel.',
    desc: 'Stock por producto, ventas por método de pago y alertas cuando algo se está por agotar.',
    rows: [['Proteína 1 kg', 'Stock 4', 'var(--acc)'], ['Botella GymOS', 'Stock 32', '#5FD4C4'], ['Remera dry-fit M', 'Sin stock', '#FF8A80']],
  },
  {
    title: 'Reportes',
    headline: 'Ingresos, retención y horas pico en un vistazo.',
    desc: 'Compará meses, detectá socios en riesgo de baja y decidí con números, no con intuición.',
    rows: [['Ingresos del mes', 'vs. mes anterior', '#5FD4C4'], ['Socios en riesgo', 'sin visitas en 14 días', 'var(--acc)'], ['Hora pico', '18 a 20 h', '#8AB4FF']],
  },
]
const DEFAULT_MARQUEE = ['Socios', 'Membresías', 'Check-in QR', 'Clases', 'Entrenadores', 'Tienda', 'Inventario', 'Pagos', 'Reportes', 'Comunicaciones']

const STEPS = [
  { title: 'Pedí tu demo', desc: 'Elegí un horario y te mostramos el sistema con los datos de tu gimnasio.' },
  { title: 'Cargá socios y planes', desc: 'Importá tus socios desde Excel, definí tus planes y sumá a tu equipo con su rol.' },
  { title: 'Abrí la puerta', desc: 'Check-in con QR, cobros al día y recordatorios automáticos de vencimiento.' },
]

const STATS = [
  { value: '10+', label: 'módulos integrados' },
  { value: '4', label: 'roles de acceso' },
  { value: '24/7', label: 'soporte incluido' },
]

function Arrow() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function CtaLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (href.startsWith('http')) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
  }
  return <Link href={href} className={className}>{children}</Link>
}

function Header({ saasName, logoUrl, showPlans }: { saasName: string; logoUrl: string | null; showPlans: boolean }) {
  return (
    <header className="relative z-[5] border-b border-[#1c1c1e]">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5 text-white no-underline">
          <span className="relative flex size-[34px] items-center justify-center overflow-hidden rounded-[9px] bg-(--acc)">
            {logoUrl
              ? <Image src={logoUrl} alt="" fill className="object-cover" sizes="34px" />
              : <Dumbbell className="size-[17px] text-[#0b0b0c]" strokeWidth={2.4} aria-hidden="true" />}
          </span>
          <span className="text-[19px] font-black tracking-[-0.01em] [font-stretch:115%]">{saasName}</span>
        </Link>
        <nav aria-label="Principal" className="hidden flex-wrap gap-0.5 md:flex">
          <a className={s.navLink} href="#modulos">Módulos</a>
          <a className={s.navLink} href="#como">Cómo funciona</a>
          {showPlans && <a className={s.navLink} href="#precios">Precios</a>}
        </nav>
        <div className="flex items-center gap-2">
          <Link className={s.navLink} href="/login">Iniciar sesión</Link>
          <a className={`${s.btnY} ${s.btnSm}`} href="#acceso">Pedir demo</a>
        </div>
      </div>
    </header>
  )
}

function Hero({ title, subtitle, ctaText, ctaUrl }: { title: string | null; subtitle: string; ctaText: string; ctaUrl: string }) {
  // A title set in admin replaces the rolling words; its second half takes the accent
  const words = title?.split(' ') ?? []
  const half = Math.ceil(words.length / 2)

  return (
    <section id="top" className={`${s.gridBg} relative px-6 pt-[88px] pb-[120px]`}>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14">
        <div className="min-w-0 flex-[1_1_520px]">
          <div className={`${s.rise} inline-flex items-center gap-2.5 rounded-full border border-[#2a2a2c] bg-[#0b0b0c] px-3.5 py-2 text-[13px] font-semibold text-[#d4d4cf]`}>
            <span className={`${s.live} size-2`} />
            Software de gestión para gimnasios
          </div>
          <h1 className={`${s.rise} ${s.d1} mt-7 mb-0 text-[clamp(48px,7.2vw,104px)] leading-[0.98] font-black tracking-[-0.035em] [font-stretch:118%]`}>
            {title ? (
              <>
                <span className="block">{words.slice(0, half).join(' ')}</span>
                <span className={`${s.acc} block`}>{words.slice(half).join(' ')}</span>
              </>
            ) : (
              <>
                <span className="block">Tu gimnasio,</span>
                <HeroWords />
              </>
            )}
          </h1>
          <p className={`${s.rise} ${s.d2} mt-7 mb-0 max-w-[520px] text-[19px] leading-[1.55] text-[#b4b4ae]`}>{subtitle}</p>
          <div className={`${s.rise} ${s.d3} mt-9 flex flex-wrap gap-3`}>
            <CtaLink href={ctaUrl} className={s.btnY}>{ctaText}<Arrow /></CtaLink>
            <a className={s.btnGhost} href="#modulos">Ver módulos</a>
          </div>
          <dl className={`${s.rise} ${s.d4} mt-12 mb-0 flex flex-wrap gap-7`}>
            {STATS.map(st => (
              <div key={st.label} className="flex flex-col-reverse">
                <dt className="mt-0.5 text-[13px] text-[#a3a39d]">{st.label}</dt>
                <dd className={`${s.mono} m-0 text-[28px] font-bold`}>{st.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <LiveCheckins />
      </div>
    </section>
  )
}

function Marquee({ items }: { items: string[] }) {
  const all = items.concat(items)
  return (
    <div className={s.band} aria-hidden="true">
      <div className={s.marquee}>
        {all.map((m, i) => <span key={i} className={s.marqueeItem}>{m}</span>)}
      </div>
    </div>
  )
}

function Modules({ modules }: { modules: LandingModule[] }) {
  return (
    <section id="modulos" className="px-6 pt-[140px] pb-[120px]">
      <div className="mx-auto max-w-[1240px]">
        <div className={`${s.reveal} flex flex-wrap items-end justify-between gap-6`}>
          <h2 className={`${s.display} m-0 max-w-[760px] text-[clamp(40px,5vw,72px)]`}>Todo el gimnasio, <span className={s.acc}>un solo panel.</span></h2>
          <p className="m-0 max-w-[360px] text-base leading-[1.55] text-[#a3a39d]">
            Elegí un módulo o dejá que pasen solos. Cada uno se conecta con los demás: un pago renueva la membresía y habilita el check-in.
          </p>
        </div>
        <ModuleTabs modules={modules} />
      </div>
    </section>
  )
}

function Steps() {
  return (
    <section id="como" className="px-6 pt-10 pb-[140px]">
      <div className="mx-auto max-w-[1240px]">
        <h2 className={`${s.display} ${s.reveal} m-0 text-[clamp(40px,5vw,72px)]`}>En marcha en <span className={s.acc}>tres pasos.</span></h2>
        <ol className="mt-14 mb-0 flex list-none flex-wrap gap-4 p-0">
          {STEPS.map((st, i) => (
            <li key={st.title} className={`${s.reveal} flex min-w-0 flex-[1_1_300px]`}>
              <article className={`${s.cardHover} w-full rounded-[22px] border border-[#2a2a2c] bg-[#0f0f10] p-8`}>
                <div className={`${s.mono} ${s.acc} text-[56px] leading-none font-bold`} aria-hidden="true">0{i + 1}</div>
                <h3 className="mt-7 mb-0 text-[26px] font-extrabold [font-stretch:112%]">{st.title}</h3>
                <p className="mt-3 mb-0 text-base leading-[1.6] text-[#a3a39d]">{st.desc}</p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function ClosingCta() {
  return (
    <section className="relative overflow-hidden px-6 py-[160px]">
      <div className={`${s.gridBg} absolute inset-0 opacity-70`} aria-hidden="true" />
      <div className="relative mx-auto max-w-[1040px] text-center">
        <h2 className={`${s.reveal} m-0 text-[clamp(52px,8vw,128px)] leading-[0.95] font-black tracking-[-0.04em] [font-stretch:120%]`}>
          Menos planillas.<br /><span className={s.acc}>Más entrenamiento.</span>
        </h2>
        <p className={`${s.reveal} mx-auto mt-7 mb-0 max-w-[560px] text-[19px] leading-[1.55] text-[#b4b4ae]`}>
          Te mostramos el sistema en 20 minutos, con tus planes y tus números.
        </p>
        <div className={`${s.reveal} mt-10 flex flex-wrap justify-center gap-3`}>
          <a className={s.btnY} href="#acceso">Reservar demo<Arrow /></a>
          <Link className={s.btnGhost} href="/login">Ya tengo cuenta</Link>
        </div>
      </div>
    </section>
  )
}

function Footer({ settings }: { settings: PlatformSettings }) {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-[#1c1c1e] px-6 py-8">
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-4 text-sm text-[#a3a39d]">
        <span>{settings.footerText || `© ${year} ${settings.saasName} · Gestión profesional para tu gimnasio`}</span>
        <span className="flex flex-wrap gap-5">
          <Link className={s.footLink} href="/terminos">Términos</Link>
          {settings.footerLinks.map((l, i) => (
            <a key={i} className={s.footLink} href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
          ))}
          {settings.footerShowPoweredBy && settings.creatorName && (
            <span>
              Desarrollado por{' '}
              {settings.creatorUrl
                ? <a className={s.footLink} href={settings.creatorUrl} target="_blank" rel="noopener noreferrer">{settings.creatorName}</a>
                : settings.creatorName}
            </span>
          )}
        </span>
      </div>
    </footer>
  )
}

export default async function LandingPage() {
  const [settings, plans] = await Promise.all([getSettings(), getPlans()])

  const primaryColor = settings.primaryColor || '#fffb00'
  const heroSubtitle = settings.heroSubtitle || 'Socios, membresías, pagos, check-in, clases y tienda en un solo panel. Dejá las planillas y mirá tu negocio en tiempo real.'
  const heroCtaText = settings.heroCtaText || 'Empezá gratis'
  const heroCtaUrl = settings.heroCtaUrl || '/login'
  const showPlans = settings.landingShowPlans && plans.length > 0

  const features = settings.landingFeatures.filter(f => f.title)
  const modules: LandingModule[] = features.length
    ? features.map(f => ({ title: f.title, headline: f.title, desc: f.description }))
    : DEFAULT_MODULES
  const marquee = features.length >= 4 ? features.map(f => f.title) : DEFAULT_MARQUEE

  return (
    <div className={s.root} style={{ '--acc': primaryColor } as React.CSSProperties}>
      <Header saasName={settings.saasName} logoUrl={settings.logoUrl} showPlans={showPlans} />
      <main>
        <Hero title={settings.heroTitle} subtitle={heroSubtitle} ctaText={heroCtaText} ctaUrl={heroCtaUrl} />
        <Marquee items={marquee} />
        <Modules modules={modules} />
        <Steps />
        {showPlans && <PricingSection plans={plans} primaryColor={primaryColor} ctaUrl={heroCtaUrl} />}
        <AccessRequestBanner primaryColor={primaryColor} availableSlots={settings.availableSlots ?? []} />
        <ClosingCta />
      </main>
      <Footer settings={settings} />
    </div>
  )
}
