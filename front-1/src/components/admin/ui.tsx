import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn, normalizeLogoUrl } from '@/lib/utils'

/* Shared building blocks for the super-admin panel.
   Colors come from the `adm-*` tokens defined under `.admin-shell` in globals.css. */

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'high' | 'neutral'

const TONE: Record<Tone, string> = {
  ok: 'bg-adm-ok-bg text-adm-ok-fg border-adm-ok-line',
  warn: 'bg-adm-warn-bg text-adm-warn-fg border-adm-warn-line',
  bad: 'bg-adm-bad-bg text-adm-bad-fg border-adm-bad-line',
  info: 'bg-adm-info-bg text-adm-info-fg border-adm-info-line',
  high: 'bg-adm-high-bg text-adm-high-fg border-adm-high-line',
  neutral: 'bg-adm-chip text-adm-muted border-adm-line',
}

export const toneText: Record<Tone, string> = {
  ok: 'text-adm-ok-fg',
  warn: 'text-adm-warn-fg',
  bad: 'text-adm-bad-fg',
  info: 'text-adm-info-fg',
  high: 'text-adm-high-fg',
  neutral: 'text-adm-muted',
}

export function Pill({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-4',
        TONE[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 min-h-11 px-4.5 rounded-[10px] border border-adm-night bg-adm-brand text-adm-night text-sm font-bold hover:brightness-95 transition disabled:opacity-50 disabled:pointer-events-none',
  dark:
    'inline-flex items-center justify-center gap-1.5 min-h-9 px-3.5 rounded-lg bg-adm-ink text-adm-surface text-[13px] font-semibold hover:opacity-85 transition disabled:opacity-50 disabled:pointer-events-none',
  line:
    'inline-flex items-center justify-center gap-1.5 min-h-9 px-3 rounded-lg border border-adm-line bg-adm-surface text-adm-ink text-[13px] font-semibold hover:border-adm-ink transition-colors disabled:opacity-50 disabled:pointer-events-none',
  danger:
    'inline-flex items-center justify-center gap-1.5 min-h-9 px-3.5 rounded-lg border border-adm-bad-line bg-adm-surface text-adm-bad-fg text-[13px] font-bold hover:bg-adm-bad-bg transition-colors disabled:opacity-50 disabled:pointer-events-none',
  dangerSolid:
    'inline-flex items-center justify-center gap-1.5 min-h-9 px-3.5 rounded-lg bg-[#e5484d] text-white text-[13px] font-bold hover:brightness-95 transition disabled:opacity-50 disabled:pointer-events-none',
  icon:
    'inline-flex items-center justify-center size-9 rounded-lg text-adm-muted hover:bg-adm-chip hover:text-adm-ink transition-colors disabled:opacity-50',
  link: 'inline-flex items-center gap-1 text-[13px] font-semibold text-adm-ok-fg hover:underline underline-offset-2',
}

export const field = {
  label: 'block text-[13px] font-semibold text-adm-ink mb-1.5',
  input:
    'w-full min-h-11 rounded-[10px] border border-adm-line bg-adm-surface px-3 text-sm text-adm-ink placeholder:text-adm-muted/70 focus:outline-none focus:border-adm-ink transition-colors disabled:opacity-60',
  textarea:
    'w-full min-h-28 rounded-[10px] border border-adm-line bg-adm-surface px-3 py-2.5 text-sm leading-relaxed text-adm-ink placeholder:text-adm-muted/70 focus:outline-none focus:border-adm-ink transition-colors resize-y disabled:opacity-60',
  hint: 'mt-1.5 text-xs text-adm-muted',
  error: 'mt-1.5 text-xs font-medium text-adm-bad-fg',
}

/** Pill-style filter / segmented button. */
export function chip(active: boolean) {
  return cn(
    'inline-flex items-center gap-2 min-h-9 px-3.5 rounded-full border text-[13px] font-semibold transition-colors',
    active
      ? 'bg-adm-ink border-adm-ink text-adm-surface'
      : 'bg-adm-surface border-adm-line text-adm-ink hover:border-adm-ink',
  )
}

export function AdminPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 lg:px-10 flex flex-col gap-6', className)}>
      {children}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  actions,
  breadcrumb,
  media,
  meta,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  actions?: React.ReactNode
  breadcrumb?: { label: string; href?: string }[]
  /** Element shown left of the title, e.g. a logo. */
  media?: React.ReactNode
  /** Line shown under the title. */
  meta?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      {breadcrumb && (
        <nav aria-label="Ruta" className="flex items-center gap-1.5 text-[13px] text-adm-muted">
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {b.href ? (
                <Link href={b.href} className="font-semibold hover:text-adm-ink transition-colors">
                  {b.label}
                </Link>
              ) : (
                <span className="font-semibold text-adm-ink">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-[18px]">
          {media}
          <div className="min-w-0">
            {eyebrow && <div className="mb-1 text-[13px] font-medium text-adm-muted">{eyebrow}</div>}
            <h1 className="text-3xl sm:text-[40px] leading-none font-extrabold tracking-tight [font-stretch:115%]">
              {title}
            </h1>
            {meta && <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-adm-muted">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
    </div>
  )
}

export function SectionLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-xs font-bold uppercase tracking-[0.1em] text-adm-muted">
      {children}
    </h2>
  )
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  id?: string
}) {
  return (
    <section
      aria-labelledby={title && id ? id : undefined}
      className={cn('rounded-2xl border border-adm-line bg-adm-surface overflow-hidden', className)}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-adm-line-soft px-5 py-4">
          {title && (
            <h2 id={id} className="text-[15px] font-bold">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={btn.link}>
      {children}
      <ChevronRight className="size-3.5" aria-hidden="true" />
    </Link>
  )
}

export function Stat({
  label,
  value,
  unit,
  hint,
  hintTone = 'neutral',
  children,
  className,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  hint?: React.ReactNode
  hintTone?: Tone
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex-1 basis-52 rounded-2xl border border-adm-line bg-adm-surface p-5', className)}>
      <div className="text-[13px] font-semibold text-adm-muted">{label}</div>
      <div className="mt-2.5 font-admin-mono text-[30px] leading-tight font-bold tracking-tight">
        {unit && <span className="mr-1.5 text-base font-medium text-adm-muted">{unit}</span>}
        {value}
      </div>
      {children}
      {hint && <div className={cn('mt-2 text-[13px] font-semibold', toneText[hintTone])}>{hint}</div>}
    </div>
  )
}

export function Meter({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-adm-chip', className)}>
      <div className="h-full bg-adm-ink" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

const MARK_SIZE = {
  sm: 'size-9 rounded-[10px] text-xs',
  md: 'size-11 rounded-xl text-sm',
  lg: 'size-[72px] rounded-[18px] text-2xl',
}

/** Gym logo, falling back to initials on the brand yellow. */
export function GymMark({
  name,
  logoUrl,
  size = 'sm',
}: {
  name: string
  logoUrl?: string | null
  size?: keyof typeof MARK_SIZE
}) {
  const src = normalizeLogoUrl(logoUrl)
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden border border-adm-night/15 bg-adm-brand font-black text-adm-night',
        MARK_SIZE[size],
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  )
}

export function PersonMark({ name, dark = false }: { name: string; dark?: boolean }) {
  return (
    <div
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
        dark ? 'bg-adm-ink text-adm-surface' : 'bg-adm-chip text-adm-ink',
      )}
    >
      {initials(name)}
    </div>
  )
}

export function EmptyState({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-14 text-center text-sm text-adm-muted">
      {icon && <div className="opacity-40">{icon}</div>}
      {children}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange?: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'flex h-[26px] w-11 shrink-0 items-center rounded-full p-[3px] transition-colors disabled:opacity-50',
        checked ? 'justify-end bg-[#0e7a70]' : 'justify-start bg-[#c9c9c1] dark:bg-[#3a3a3d]',
      )}
    >
      <span className="size-5 rounded-full bg-white shadow-sm" />
    </button>
  )
}

export const th = 'px-3 py-2.5 text-left text-xs font-semibold text-adm-muted bg-adm-subtle whitespace-nowrap'
export const td = 'px-3 py-3 border-t border-adm-line-soft'
