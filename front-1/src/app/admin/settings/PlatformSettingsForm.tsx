'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Camera, Dumbbell, Globe, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updatePlatformSettingsAction } from './actions'
import { type PlatformSettings, type FooterLink, type LandingFeature } from './types'
import { createHandlers } from '@/lib/input-validation'
import { cn } from '@/lib/utils'
import { Switch, btn, field } from '@/components/admin/ui'

const MAX_SIZE = 2 * 1024 * 1024

interface Props { settings: PlatformSettings }

const SECTIONS = [
  { id: 'marca', label: 'Marca' },
  { id: 'landing', label: 'Landing' },
  { id: 'footer', label: 'Footer y créditos' },
  { id: 'terminos', label: 'Términos' },
] as const

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6 rounded-2xl border border-adm-line bg-adm-surface">
      <div className="border-b border-adm-line-soft px-6 py-4">
        <h2 id={`${id}-h`} className="text-[17px] font-bold">{title}</h2>
        <p className="mt-0.5 text-[13px] text-adm-muted">{description}</p>
      </div>
      <div className="flex flex-col gap-5 p-6">{children}</div>
    </section>
  )
}

function ToggleRow({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-adm-line-soft px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-xs text-adm-muted">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

export function PlatformSettingsForm({ settings }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isUploading, startUploadTransition] = useTransition()

  const [saasName, setSaasName] = useState(settings.saasName)
  const router = useRouter()
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? '')
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor ?? '#fffb00')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [creatorName, setCreatorName] = useState(settings.creatorName ?? '')
  const [creatorUrl, setCreatorUrl] = useState(settings.creatorUrl ?? '')

  const [footerText, setFooterText] = useState(settings.footerText ?? '')
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>(settings.footerLinks ?? [])
  const [showPoweredBy, setShowPoweredBy] = useState(settings.footerShowPoweredBy)

  const [heroTitle, setHeroTitle] = useState(settings.heroTitle ?? '')
  const [heroSubtitle, setHeroSubtitle] = useState(settings.heroSubtitle ?? '')
  const [heroCtaText, setHeroCtaText] = useState(settings.heroCtaText ?? '')
  const [heroCtaUrl, setHeroCtaUrl] = useState(settings.heroCtaUrl ?? '')

  const [landingFeatures, setLandingFeatures] = useState<LandingFeature[]>(settings.landingFeatures ?? [])
  const [landingShowPlans, setLandingShowPlans] = useState(settings.landingShowPlans ?? true)

  const [termsContent, setTermsContent] = useState(settings.termsContent ?? '')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    if (!file.type.startsWith('image/')) { setUploadError('Solo imágenes'); return }
    if (file.size > MAX_SIZE) { setUploadError('Máx. 2MB'); return }
    const fd = new FormData()
    fd.append('logo', file)
    startUploadTransition(async () => {
      const res = await fetch('/api/v1/admin/platform-settings/logo', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({})) as { error?: string; logoUrl?: string }
      if (!res.ok || data.error) { toast.error(data.error ?? 'Error al subir la imagen') }
      else if (data.logoUrl) {
        setLogoUrl(data.logoUrl)
        // The logo is already saved: refresh so the sidebar shows it
        router.refresh()
      }
    })
    e.target.value = ''
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!saasName.trim()) { toast.error('El nombre es obligatorio'); return }
    startTransition(async () => {
      const result = await updatePlatformSettingsAction({
        saasName: saasName.trim(),
        footerText: footerText.trim() || null,
        footerLinks: footerLinks.filter(l => l.label.trim() && l.url.trim()),
        footerShowPoweredBy: showPoweredBy,
        creatorName: creatorName.trim() || null,
        creatorUrl: creatorUrl.trim() || null,
        heroTitle: heroTitle.trim() || null,
        heroSubtitle: heroSubtitle.trim() || null,
        heroCtaText: heroCtaText.trim() || null,
        heroCtaUrl: heroCtaUrl.trim() || null,
        primaryColor: primaryColor || '#fffb00',
        landingFeatures: landingFeatures.filter(f => f.title.trim()),
        landingShowPlans,
        termsContent: termsContent.trim() || null,
      })
      if (result.error) { toast.error(result.error) } else { toast.success('Configuración guardada') }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <nav aria-label="Secciones" className="flex min-w-0 flex-[1_1_180px] flex-wrap gap-1 lg:sticky lg:top-6 lg:max-w-[200px] lg:flex-col">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-adm-muted transition-colors hover:bg-adm-surface hover:text-adm-ink"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Section id="marca" title="Marca" description="Nombre, logo y color principal de la plataforma">
            <div className="flex flex-wrap items-center gap-5 rounded-xl border border-adm-line-soft bg-adm-subtle p-4">
              <div
                className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-adm-night/15"
                style={{ background: primaryColor || '#fffb00' }}
              >
                {logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoUrl} alt="Logo actual" className="size-full object-cover" />
                  : <Dumbbell className="size-8 text-black" aria-hidden="true" />}
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="size-5 animate-spin text-white" aria-label="Subiendo" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-[1_1_200px]">
                <p className="text-sm font-semibold">Logo de la plataforma</p>
                <p className="mt-0.5 text-xs text-adm-muted">PNG, JPG, WebP · Máx. 2MB · Recomendado 512×512</p>
                {uploadError && <p className={field.error}>{uploadError}</p>}
              </div>
              <button type="button" disabled={isUploading || isPending} onClick={() => fileRef.current?.click()} className={btn.line}>
                <Camera className="size-3.5" aria-hidden="true" />
                {isUploading ? 'Subiendo…' : 'Cambiar logo'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="min-w-0 flex-1 basis-56">
                <span className={field.label}>Nombre del SaaS</span>
                <input type="text" value={saasName} onChange={e => setSaasName(e.target.value)} placeholder="GymOS" disabled={isPending} className={field.input} {...createHandlers('text')} />
              </label>
              <div className="min-w-0 flex-1 basis-56">
                <label htmlFor="primary-color" className={field.label}>Color principal</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    disabled={isPending}
                    aria-label="Elegir color"
                    className="h-11 w-12 shrink-0 cursor-pointer rounded-[10px] border border-adm-line bg-adm-surface p-1 disabled:opacity-50"
                  />
                  <input
                    id="primary-color"
                    type="text"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    disabled={isPending}
                    className={cn(field.input, 'font-admin-mono')}
                    placeholder="#fffb00"
                    {...createHandlers('text')}
                  />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex h-7 items-center rounded-lg border border-black/20 px-3 text-[11px] font-black text-black" style={{ background: primaryColor }}>
                    Botón CTA
                  </span>
                  <span className="text-xs text-adm-muted">Vista previa del color</span>
                </div>
              </div>
            </div>
          </Section>

          <Section id="landing" title="Landing" description="Sección principal, beneficios y precios de la página pública">
            <label className="block">
              <span className={field.label}>Título principal</span>
              <input type="text" value={heroTitle} onChange={e => setHeroTitle(e.target.value)} placeholder="Gestión profesional para tu gimnasio" disabled={isPending} className={field.input} {...createHandlers('text')} />
              <span className={field.hint}>Se divide en 2 líneas automáticamente. La segunda usa el color principal.</span>
            </label>
            <label className="block">
              <span className={field.label}>Subtítulo</span>
              <textarea value={heroSubtitle} onChange={e => setHeroSubtitle(e.target.value)} placeholder="Todo lo que necesitás para administrar tu gimnasio..." disabled={isPending} rows={2} className={cn(field.textarea, 'min-h-20')} {...createHandlers('text')} />
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="min-w-0 flex-1 basis-48">
                <span className={field.label}>Texto del botón CTA</span>
                <input type="text" value={heroCtaText} onChange={e => setHeroCtaText(e.target.value)} placeholder="Comenzar gratis" disabled={isPending} className={field.input} {...createHandlers('text')} />
              </label>
              <label className="min-w-0 flex-1 basis-48">
                <span className={field.label}>URL del botón CTA</span>
                <input type="text" value={heroCtaUrl} onChange={e => setHeroCtaUrl(e.target.value)} placeholder="/login o https://wa.me/..." disabled={isPending} className={field.input} {...createHandlers('url')} />
                <span className={field.hint}>Vacío → va al login. Las URLs externas abren en otra pestaña.</span>
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={cn(field.label, 'mb-0')}>Beneficios</span>
                <span className="font-admin-mono text-xs text-adm-muted">{landingFeatures.length}/6</span>
              </div>
              {landingFeatures.length === 0 ? (
                <p className="rounded-xl border border-dashed border-adm-line bg-adm-subtle py-6 text-center text-[13px] text-adm-muted">
                  Sin beneficios. Agregá hasta 6.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {landingFeatures.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl border border-adm-line-soft bg-adm-subtle p-3">
                      <span className="mt-3 w-6 shrink-0 font-admin-mono text-xs font-bold text-adm-muted">{i + 1}</span>
                      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                        <input
                          type="text"
                          value={feat.title}
                          onChange={e => setLandingFeatures(prev => prev.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))}
                          placeholder="Título"
                          aria-label={`Título del beneficio ${i + 1}`}
                          disabled={isPending}
                          className={cn(field.input, 'flex-1 basis-40')}
                          {...createHandlers('text')}
                        />
                        <input
                          type="text"
                          value={feat.description}
                          onChange={e => setLandingFeatures(prev => prev.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                          placeholder="Descripción breve"
                          aria-label={`Descripción del beneficio ${i + 1}`}
                          disabled={isPending}
                          className={cn(field.input, 'flex-[2_1_240px]')}
                          {...createHandlers('text')}
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={`Eliminar beneficio ${i + 1}`}
                        onClick={() => setLandingFeatures(prev => prev.filter((_, idx) => idx !== i))}
                        disabled={isPending}
                        className={cn(btn.icon, 'size-11 hover:bg-adm-bad-bg hover:text-adm-bad-fg')}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setLandingFeatures(prev => [...prev, { title: '', description: '' }])}
                disabled={isPending || landingFeatures.length >= 6}
                className={cn(btn.line, 'mt-2')}
              >
                <Plus className="size-3.5" aria-hidden="true" /> Agregar beneficio
              </button>
            </div>

            <ToggleRow checked={landingShowPlans} onChange={setLandingShowPlans} label="Mostrar precios en la landing" hint="Usa los planes marcados como visibles" />
          </Section>

          <Section id="footer" title="Footer y créditos" description="Pie de página de todas las páginas">
            <ToggleRow checked={showPoweredBy} onChange={setShowPoweredBy} label={`Mostrar “Desarrollado por ${saasName || 'SaaS'}”`} />
            <label className="block">
              <span className={field.label}>Texto del footer</span>
              <input type="text" value={footerText} onChange={e => setFooterText(e.target.value)} placeholder={`© ${new Date().getFullYear()} ${saasName}. Todos los derechos.`} disabled={isPending} className={field.input} {...createHandlers('text')} />
            </label>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={cn(field.label, 'mb-0')}>Links extra</span>
                <span className="font-admin-mono text-xs text-adm-muted">{footerLinks.length}/6</span>
              </div>
              <div className="flex flex-col gap-2">
                {footerLinks.length === 0 && <p className="text-[13px] text-adm-muted">Sin links configurados.</p>}
                {footerLinks.map((link, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={link.label}
                      onChange={e => setFooterLinks(prev => prev.map((l, idx) => idx === i ? { ...l, label: e.target.value } : l))}
                      placeholder="Texto"
                      aria-label={`Texto del link ${i + 1}`}
                      disabled={isPending}
                      className={cn(field.input, 'flex-1 basis-40')}
                      {...createHandlers('text')}
                    />
                    <input
                      type="text"
                      value={link.url}
                      onChange={e => setFooterLinks(prev => prev.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l))}
                      placeholder="https://…"
                      aria-label={`URL del link ${i + 1}`}
                      disabled={isPending}
                      className={cn(field.input, 'flex-[2_1_240px]')}
                      {...createHandlers('url')}
                    />
                    <button
                      type="button"
                      aria-label={`Eliminar link ${i + 1}`}
                      onClick={() => setFooterLinks(prev => prev.filter((_, idx) => idx !== i))}
                      disabled={isPending}
                      className={cn(btn.icon, 'size-11 hover:bg-adm-bad-bg hover:text-adm-bad-fg')}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFooterLinks(prev => [...prev, { label: '', url: '' }])}
                disabled={isPending || footerLinks.length >= 6}
                className={cn(btn.line, 'mt-2')}
              >
                <Plus className="size-3.5" aria-hidden="true" /> Agregar link
              </button>
            </div>
            <div className="flex flex-wrap gap-4 border-t border-adm-line-soft pt-5">
              <label className="min-w-0 flex-1 basis-48">
                <span className={field.label}>Creado por</span>
                <input type="text" value={creatorName} onChange={e => setCreatorName(e.target.value)} placeholder="Tu nombre" disabled={isPending} className={field.input} {...createHandlers('name')} />
              </label>
              <label className="min-w-0 flex-1 basis-48">
                <span className={field.label}>Link / portfolio</span>
                <input type="text" value={creatorUrl} onChange={e => setCreatorUrl(e.target.value)} placeholder="https://..." disabled={isPending} className={field.input} {...createHandlers('url')} />
              </label>
            </div>
          </Section>

          <Section id="terminos" title="Términos y condiciones" description="Contenido de /terminos — texto plano o Markdown (## título, - lista, **negrita**)">
            <textarea
              value={termsContent}
              onChange={e => setTermsContent(e.target.value)}
              rows={16}
              disabled={isPending}
              aria-label="Términos y condiciones"
              placeholder={'## Términos y Condiciones\n\nÚltima actualización: ...\n\n### 1. Uso del servicio\n\nAl usar esta plataforma aceptás los siguientes términos...'}
              className={cn(field.textarea, 'min-h-80 font-admin-mono text-xs')}
              {...createHandlers('text')}
            />
            <p className="flex items-center gap-1.5 text-xs text-adm-muted">
              <Globe className="size-3.5" aria-hidden="true" />
              Visible en <a href="/terminos" target="_blank" rel="noopener noreferrer" className="font-semibold underline">/terminos</a>
            </p>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-adm-line bg-adm-ground/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <p className="text-[13px] text-adm-muted">Los cambios se ven en la landing y el footer al guardar.</p>
        <button type="submit" disabled={isPending || isUploading} className={btn.primary}>
          {isPending ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Guardando…</> : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
