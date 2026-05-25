'use client'

import { useState, useTransition, useRef } from 'react'
import { Plus, Trash2, Camera, Dumbbell, Palette, Layout, List, FileText, User, AlignLeft } from 'lucide-react'
import { toast } from 'sonner'
import { updatePlatformSettingsAction, uploadPlatformLogoAction } from './actions'
import { type PlatformSettings, type FooterLink, type LandingFeature } from './types'
import { createHandlers } from '@/lib/input-validation'

const MAX_SIZE = 2 * 1024 * 1024

interface Props { settings: PlatformSettings }

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'
const labelClass = 'text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1.5'

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" role="switch" aria-checked={checked} onClick={onChange}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-black' : 'bg-zinc-300'}`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
      <span className="text-sm font-medium cursor-pointer" onClick={onChange}>{label}</span>
    </div>
  )
}

function Card({ icon: Icon, title, description, children }: {
  icon: React.ElementType; title: string; description: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-zinc-500" />
        </div>
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="text-xs text-zinc-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export function PlatformSettingsForm({ settings }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isUploading, startUploadTransition] = useTransition()

  const [saasName, setSaasName] = useState(settings.saasName)
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
      const res = await uploadPlatformLogoAction(fd)
      if (res.error) { toast.error(res.error) } else if (res.logoUrl) { setLogoUrl(res.logoUrl) }
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
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Row 1: Identidad (2/3) + Creator + Footer (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Identidad — 2 cols */}
        <div className="lg:col-span-2">
          <Card icon={Palette} title="Identidad" description="Logo, nombre y color de la plataforma">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: primaryColor || '#fffb00' }}>
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  : <Dumbbell className="h-7 w-7 text-black" />
                }
                {isUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
                    <span className="text-white text-xs font-bold">…</span>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <button type="button" disabled={isUploading || isPending} onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all disabled:opacity-50">
                  <Camera className="h-4 w-4" />
                  {isUploading ? 'Subiendo…' : 'Cambiar logo'}
                </button>
                <p className="text-xs text-zinc-400">PNG, JPG, WebP · Máx. 2MB</p>
                {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nombre del SaaS</label>
                <input type="text" value={saasName} onChange={e => setSaasName(e.target.value)} placeholder="GymOS" disabled={isPending} className={inputClass} {...createHandlers('text')} />
              </div>
              <div>
                <label className={labelClass}>Color principal</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} disabled={isPending}
                    className="h-[42px] w-12 rounded-xl border border-zinc-200 cursor-pointer disabled:opacity-50 p-1 shrink-0" />
                  <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} disabled={isPending} className={inputClass} placeholder="#fffb00" {...createHandlers('text')} />
                </div>
                <p className="text-xs text-zinc-400 mt-1.5">Se usa en landing, botones y acentos.</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Creator + Footer stacked */}
        <div className="space-y-6">
          <Card icon={User} title="Creador" description="Aparece en el footer">
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nombre</label>
                <input type="text" value={creatorName} onChange={e => setCreatorName(e.target.value)} placeholder="Tu nombre" disabled={isPending} className={inputClass} {...createHandlers('name')} />
              </div>
              <div>
                <label className={labelClass}>Link</label>
                <input type="text" value={creatorUrl} onChange={e => setCreatorUrl(e.target.value)} placeholder="https://..." disabled={isPending} className={inputClass} {...createHandlers('url')} />
              </div>
            </div>
          </Card>

          <Card icon={AlignLeft} title="Footer" description="Pie de página global">
            <Toggle checked={showPoweredBy} onChange={() => setShowPoweredBy(v => !v)} label={`"Desarrollado por ${saasName || 'SaaS'}"`} />
            <div>
              <label className={labelClass}>Texto</label>
              <input type="text" value={footerText} onChange={e => setFooterText(e.target.value)}
                placeholder={`© ${new Date().getFullYear()} ${saasName}. Todos los derechos reservados.`}
                disabled={isPending} className={inputClass} {...createHandlers('text')} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={labelClass + ' mb-0'}>Links</label>
                <button type="button" onClick={() => setFooterLinks(prev => [...prev, { label: '', url: '' }])}
                  disabled={isPending || footerLinks.length >= 6}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-black transition-colors disabled:opacity-40">
                  <Plus className="h-3 w-3" /> Agregar
                </button>
              </div>
              {footerLinks.length === 0 && <p className="text-xs text-zinc-400">Sin links</p>}
              {footerLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input type="text" value={link.label} onChange={e => setFooterLinks(prev => prev.map((l, idx) => idx === i ? { ...l, label: e.target.value } : l))}
                    placeholder="Label" disabled={isPending} className={inputClass} {...createHandlers('text')} />
                  <input type="text" value={link.url} onChange={e => setFooterLinks(prev => prev.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l))}
                    placeholder="URL" disabled={isPending} className={inputClass} {...createHandlers('url')} />
                  <button type="button" onClick={() => setFooterLinks(prev => prev.filter((_, idx) => idx !== i))} disabled={isPending}
                    className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Row 2: Hero (1/2) + Features (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card icon={Layout} title="Landing — Hero" description="Sección principal de la página de inicio">
          <div>
            <label className={labelClass}>Título principal</label>
            <input type="text" value={heroTitle} onChange={e => setHeroTitle(e.target.value)}
              placeholder="Gestión profesional para tu gimnasio" disabled={isPending} className={inputClass} {...createHandlers('text')} />
          </div>
          <div>
            <label className={labelClass}>Subtítulo</label>
            <input type="text" value={heroSubtitle} onChange={e => setHeroSubtitle(e.target.value)}
              placeholder="Todo lo que necesitás para administrar tu gimnasio en un solo lugar."
              disabled={isPending} className={inputClass} {...createHandlers('text')} />
          </div>
          <div>
            <label className={labelClass}>Texto del botón CTA</label>
            <input type="text" value={heroCtaText} onChange={e => setHeroCtaText(e.target.value)}
              placeholder="Comenzar ahora" disabled={isPending} className={inputClass} {...createHandlers('text')} />
          </div>
          <div>
            <label className={labelClass}>URL del botón CTA</label>
            <input type="text" value={heroCtaUrl} onChange={e => setHeroCtaUrl(e.target.value)}
              placeholder="https://wa.me/5491112345678 o /login" disabled={isPending} className={inputClass} {...createHandlers('url')} />
            <p className="text-xs text-zinc-400 mt-1.5">Dejá vacío para ir al login. URLs externas abren en nueva pestaña.</p>
          </div>
        </Card>

        <Card icon={List} title="Landing — Características" description="Hasta 6 beneficios en la landing">
          <div className="space-y-3">
            {landingFeatures.length === 0 && (
              <p className="text-xs text-zinc-400 py-2">Sin características. Agregá hasta 6.</p>
            )}
            {landingFeatures.map((feat, i) => (
              <div key={i} className="space-y-1.5 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-400">#{i + 1}</span>
                  <button type="button" onClick={() => setLandingFeatures(prev => prev.filter((_, idx) => idx !== i))} disabled={isPending}
                    className="p-1 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <input type="text" value={feat.title} onChange={e => setLandingFeatures(prev => prev.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))}
                  placeholder="Título" disabled={isPending} className={inputClass} {...createHandlers('text')} />
                <input type="text" value={feat.description} onChange={e => setLandingFeatures(prev => prev.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                  placeholder="Descripción" disabled={isPending} className={inputClass} {...createHandlers('text')} />
              </div>
            ))}
            <button type="button" onClick={() => setLandingFeatures(prev => [...prev, { title: '', description: '' }])}
              disabled={isPending || landingFeatures.length >= 6}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-black transition-colors disabled:opacity-40">
              <Plus className="h-3.5 w-3.5" /> Agregar característica
            </button>
          </div>
          <div className="pt-3 border-t border-zinc-100">
            <Toggle checked={landingShowPlans} onChange={() => setLandingShowPlans(v => !v)} label="Mostrar sección de precios" />
          </div>
        </Card>
      </div>

      {/* Row 3: Terms — full width */}
      <Card icon={FileText} title="Términos y condiciones" description="Contenido de /terminos — texto plano o Markdown (## título, - lista)">
        <textarea
          value={termsContent}
          onChange={e => setTermsContent(e.target.value)}
          rows={14}
          disabled={isPending}
          placeholder={'## Términos y Condiciones\n\nÚltima actualización: ...\n\nAl usar esta plataforma aceptás los siguientes términos...'}
          className={inputClass + ' resize-y font-mono text-xs leading-relaxed'}
          {...createHandlers('text')}
        />
      </Card>

      {/* Sticky save */}
      <div className="sticky bottom-0 -mx-6 lg:-mx-8 px-6 lg:px-8 py-4 bg-background/95 backdrop-blur border-t border-zinc-200 flex items-center justify-between gap-4">
        <p className="text-xs text-zinc-400">Los cambios se aplican en la landing y el footer inmediatamente.</p>
        <button type="submit" disabled={isPending || isUploading}
          className="rounded-xl bg-black px-6 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all shrink-0">
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
