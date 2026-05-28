'use client'

import { useState, useTransition, useRef } from 'react'
import {
  Plus, Trash2, Camera, Dumbbell, Palette, Layout,
  List, FileText, User, AlignLeft, GripVertical, Eye,
  Globe, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { updatePlatformSettingsAction, uploadPlatformLogoAction } from './actions'
import { type PlatformSettings, type FooterLink, type LandingFeature } from './types'
import { createHandlers } from '@/lib/input-validation'

const MAX_SIZE = 2 * 1024 * 1024

interface Props { settings: PlatformSettings }

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-zinc-400 transition-all disabled:opacity-50 disabled:bg-zinc-50 placeholder:text-zinc-300'
const labelClass = 'text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-400 block mb-1.5'

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-black ${checked ? 'bg-black' : 'bg-zinc-200'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      <span className="text-sm font-medium text-zinc-700 group-hover:text-black transition-colors" onClick={onChange}>{label}</span>
    </label>
  )
}

function SectionCard({
  icon: Icon,
  iconColor,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  iconColor: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-100 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-100">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconColor + '15', border: `1px solid ${iconColor}25` }}>
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
          <p className="text-xs text-zinc-400">{description}</p>
        </div>
      </div>
      <div className="p-6 space-y-5">
        {children}
      </div>
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
      const res = await fetch('/api/v1/admin/platform-settings/logo', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({})) as { error?: string; logoUrl?: string }
      if (!res.ok || data.error) { toast.error(data.error ?? 'Error al subir la imagen') }
      else if (data.logoUrl) { setLogoUrl(data.logoUrl) }
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
    <form onSubmit={handleSubmit} className="space-y-6 pb-24">

      {/* Row 1: Identidad (2/3) + Creator+Footer (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Identidad */}
        <div className="lg:col-span-2">
          <SectionCard icon={Palette} iconColor="#7c3aed" title="Identidad" description="Logo, nombre y color principal">

            {/* Logo + upload */}
            <div className="flex items-center gap-5 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
              <div
                className="relative h-20 w-20 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ring-4 ring-white shadow-md"
                style={{ background: primaryColor || '#fffb00' }}
              >
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  : <Dumbbell className="h-8 w-8 text-black" />
                }
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-xs font-bold animate-pulse">↑</span>
                  </div>
                )}
              </div>
              <div className="space-y-2 flex-1">
                <p className="text-sm font-semibold text-zinc-900">Logo de la plataforma</p>
                <p className="text-xs text-zinc-400">PNG, JPG, WebP · Máx. 2MB · Recomendado 512×512</p>
                <button
                  type="button"
                  disabled={isUploading || isPending}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 transition-all disabled:opacity-50 shadow-sm"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {isUploading ? 'Subiendo…' : 'Cambiar logo'}
                </button>
                {uploadError && <p className="text-xs text-red-500 font-medium">{uploadError}</p>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nombre del SaaS</label>
                <input
                  type="text"
                  value={saasName}
                  onChange={e => setSaasName(e.target.value)}
                  placeholder="GymOS"
                  disabled={isPending}
                  className={inputClass}
                  {...createHandlers('text')}
                />
              </div>
              <div>
                <label className={labelClass}>Color principal</label>
                <div className="flex items-center gap-2">
                  <div className="relative shrink-0">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={e => setPrimaryColor(e.target.value)}
                      disabled={isPending}
                      className="h-[42px] w-11 rounded-xl border border-zinc-200 cursor-pointer disabled:opacity-50 p-1"
                    />
                  </div>
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    disabled={isPending}
                    className={inputClass}
                    placeholder="#fffb00"
                    {...createHandlers('text')}
                  />
                </div>
                {/* Mini preview */}
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="h-6 rounded-lg px-3 flex items-center text-[11px] font-black"
                    style={{ background: primaryColor, color: '#000' }}
                  >
                    Botón CTA
                  </div>
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ background: primaryColor }}
                  />
                  <span className="text-[11px] text-zinc-400">Vista previa del color</span>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Creador + Footer apilados */}
        <div className="space-y-5">
          <SectionCard icon={User} iconColor="#0ea5e9" title="Creador" description="Aparece en el footer de todas las páginas">
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nombre</label>
                <input type="text" value={creatorName} onChange={e => setCreatorName(e.target.value)} placeholder="Tu nombre" disabled={isPending} className={inputClass} {...createHandlers('name')} />
              </div>
              <div>
                <label className={labelClass}>Link / Portfolio</label>
                <input type="text" value={creatorUrl} onChange={e => setCreatorUrl(e.target.value)} placeholder="https://..." disabled={isPending} className={inputClass} {...createHandlers('url')} />
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={AlignLeft} iconColor="#10b981" title="Footer" description="Pie de página global del sitio">
            <Toggle checked={showPoweredBy} onChange={() => setShowPoweredBy(v => !v)} label={`"Desarrollado por ${saasName || 'SaaS'}"`} />
            <div>
              <label className={labelClass}>Texto del footer</label>
              <input
                type="text"
                value={footerText}
                onChange={e => setFooterText(e.target.value)}
                placeholder={`© ${new Date().getFullYear()} ${saasName}. Todos los derechos.`}
                disabled={isPending}
                className={inputClass}
                {...createHandlers('text')}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={labelClass + ' mb-0'}>Links extras</label>
                <button
                  type="button"
                  onClick={() => setFooterLinks(prev => [...prev, { label: '', url: '' }])}
                  disabled={isPending || footerLinks.length >= 6}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-black transition-colors disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" /> Agregar
                </button>
              </div>
              {footerLinks.length === 0 && (
                <p className="text-xs text-zinc-300 py-1">Sin links configurados</p>
              )}
              {footerLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={link.label}
                    onChange={e => setFooterLinks(prev => prev.map((l, idx) => idx === i ? { ...l, label: e.target.value } : l))}
                    placeholder="Label"
                    disabled={isPending}
                    className={inputClass}
                    {...createHandlers('text')}
                  />
                  <input
                    type="text"
                    value={link.url}
                    onChange={e => setFooterLinks(prev => prev.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l))}
                    placeholder="URL"
                    disabled={isPending}
                    className={inputClass}
                    {...createHandlers('url')}
                  />
                  <button
                    type="button"
                    aria-label={`Eliminar link ${i + 1}`}
                    onClick={() => setFooterLinks(prev => prev.filter((_, idx) => idx !== i))}
                    disabled={isPending}
                    className="p-2 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Row 2: Hero + Características */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        <SectionCard icon={Layout} iconColor="#f59e0b" title="Landing — Hero" description="Texto y CTA de la sección principal">
          <div>
            <label className={labelClass}>Título principal</label>
            <input
              type="text"
              value={heroTitle}
              onChange={e => setHeroTitle(e.target.value)}
              placeholder="Gestión profesional para tu gimnasio"
              disabled={isPending}
              className={inputClass}
              {...createHandlers('text')}
            />
            <p className="text-[11px] text-zinc-400 mt-1.5">Se divide en 2 líneas automáticamente. La segunda tendrá el color principal.</p>
          </div>
          <div>
            <label className={labelClass}>Subtítulo</label>
            <textarea
              value={heroSubtitle}
              onChange={e => setHeroSubtitle(e.target.value)}
              placeholder="Todo lo que necesitás para administrar tu gimnasio..."
              disabled={isPending}
              rows={2}
              className={inputClass + ' resize-none'}
              {...createHandlers('text')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Texto del botón CTA</label>
              <input
                type="text"
                value={heroCtaText}
                onChange={e => setHeroCtaText(e.target.value)}
                placeholder="Comenzar gratis"
                disabled={isPending}
                className={inputClass}
                {...createHandlers('text')}
              />
            </div>
            <div>
              <label className={labelClass}>URL del botón CTA</label>
              <input
                type="text"
                value={heroCtaUrl}
                onChange={e => setHeroCtaUrl(e.target.value)}
                placeholder="/login o https://wa.me/..."
                disabled={isPending}
                className={inputClass}
                {...createHandlers('url')}
              />
            </div>
          </div>
          <p className="text-[11px] text-zinc-300">Vacío → redirige al login. URLs externas abren en nueva pestaña.</p>
        </SectionCard>

        <SectionCard icon={Sparkles} iconColor="#ec4899" title="Landing — Características" description="Hasta 6 beneficios visibles en la landing">
          <div className="space-y-2.5">
            {landingFeatures.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50">
                <List className="h-6 w-6 text-zinc-300" />
                <p className="text-xs text-zinc-400 font-medium">Sin características. Agregá hasta 6.</p>
              </div>
            )}
            {landingFeatures.map((feat, i) => (
              <div
                key={i}
                className="group rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-white hover:border-zinc-300 transition-all p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5 text-zinc-300" />
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">#{i + 1}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Eliminar característica ${i + 1}`}
                    onClick={() => setLandingFeatures(prev => prev.filter((_, idx) => idx !== i))}
                    disabled={isPending}
                    className="p-1 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <input
                  type="text"
                  value={feat.title}
                  onChange={e => setLandingFeatures(prev => prev.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))}
                  placeholder="Título de la característica"
                  disabled={isPending}
                  className={inputClass}
                  {...createHandlers('text')}
                />
                <input
                  type="text"
                  value={feat.description}
                  onChange={e => setLandingFeatures(prev => prev.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                  placeholder="Descripción breve"
                  disabled={isPending}
                  className={inputClass}
                  {...createHandlers('text')}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLandingFeatures(prev => [...prev, { title: '', description: '' }])}
            disabled={isPending || landingFeatures.length >= 6}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 py-2.5 text-sm font-semibold text-zinc-400 hover:border-zinc-300 hover:text-zinc-600 hover:bg-zinc-50 transition-all disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar característica {landingFeatures.length > 0 && `(${landingFeatures.length}/6)`}
          </button>

          <div className="pt-1 border-t border-zinc-100">
            <Toggle checked={landingShowPlans} onChange={() => setLandingShowPlans(v => !v)} label="Mostrar sección de precios en la landing" />
          </div>
        </SectionCard>
      </div>

      {/* Row 3: Terms */}
      <SectionCard icon={FileText} iconColor="#6366f1" title="Términos y condiciones" description="Contenido de /terminos — texto plano o Markdown (## título, - lista, **negrita**)">
        <textarea
          value={termsContent}
          onChange={e => setTermsContent(e.target.value)}
          rows={16}
          disabled={isPending}
          placeholder={'## Términos y Condiciones\n\nÚltima actualización: ...\n\n### 1. Uso del servicio\n\nAl usar esta plataforma aceptás los siguientes términos...'}
          className={inputClass + ' resize-y font-mono text-xs leading-relaxed'}
          {...createHandlers('text')}
        />
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Globe className="h-3 w-3" />
          Visible en{' '}
          <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600 transition-colors">
            /terminos
          </a>
        </div>
      </SectionCard>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur-sm px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-zinc-400" />
          <p className="text-xs text-zinc-400">Los cambios se reflejan en la landing y el footer al guardar.</p>
        </div>
        <button
          type="submit"
          disabled={isPending || isUploading}
          className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-sm shrink-0"
        >
          {isPending ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Guardando…
            </>
          ) : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
