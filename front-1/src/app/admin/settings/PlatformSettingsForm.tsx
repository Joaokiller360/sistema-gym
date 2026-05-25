'use client'

import { useState, useTransition, useRef } from 'react'
import { Plus, Trash2, Camera, Dumbbell } from 'lucide-react'
import { toast } from 'sonner'
import { updatePlatformSettingsAction, uploadPlatformLogoAction } from './actions'
import { type PlatformSettings, type FooterLink } from './types'
import { createHandlers } from '@/lib/input-validation'

const MAX_SIZE = 2 * 1024 * 1024

interface Props {
  settings: PlatformSettings
}

export function PlatformSettingsForm({ settings }: Props) {
  const [isPending, startTransition] = useTransition()
  const [isUploading, startUploadTransition] = useTransition()
  const [saasName, setSaasName] = useState(settings.saasName)
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? '')
  const [footerText, setFooterText] = useState(settings.footerText ?? '')
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>(settings.footerLinks)
  const [showPoweredBy, setShowPoweredBy] = useState(settings.footerShowPoweredBy)
  const [creatorName, setCreatorName] = useState(settings.creatorName ?? '')
  const [creatorUrl, setCreatorUrl] = useState(settings.creatorUrl ?? '')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  function addLink() {
    setFooterLinks(prev => [...prev, { label: '', url: '' }])
  }

  function updateLink(i: number, field: keyof FooterLink, value: string) {
    setFooterLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  function removeLink(i: number) {
    setFooterLinks(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!saasName.trim()) { toast.error('El nombre del SaaS es obligatorio'); return }
    startTransition(async () => {
      const result = await updatePlatformSettingsAction({
        saasName: saasName.trim(),
        footerText: footerText.trim() || null,
        footerLinks: footerLinks.filter(l => l.label.trim() && l.url.trim()),
        footerShowPoweredBy: showPoweredBy,
        creatorName: creatorName.trim() || null,
        creatorUrl: creatorUrl.trim() || null,
      })
      if (result.error) { toast.error(result.error) } else { toast.success('Configuración guardada') }
    })
  }

  const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black transition-all disabled:opacity-50'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* Branding */}
      <section className="rounded-xl border bg-card p-6 space-y-5">
        <div>
          <h2 className="font-semibold">Identidad de la plataforma</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Nombre y logo que aparecen en sidebar, login y metadata</p>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 rounded-2xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
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
            <button
              type="button"
              disabled={isUploading || isPending}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              {isUploading ? 'Subiendo…' : 'Cambiar logo'}
            </button>
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP · Máx. 2MB</p>
            {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* SaaS name */}
        <div className="max-w-sm space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block">Nombre</label>
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
      </section>

      {/* Creator */}
      <section className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Creador</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Se muestra en el footer con un link</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block">Nombre</label>
            <input
              type="text"
              value={creatorName}
              onChange={e => setCreatorName(e.target.value)}
              placeholder="Joao Barres"
              disabled={isPending}
              className={inputClass}
              {...createHandlers('name')}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block">Link</label>
            <input
              type="text"
              value={creatorUrl}
              onChange={e => setCreatorUrl(e.target.value)}
              placeholder="https://..."
              disabled={isPending}
              className={inputClass}
              {...createHandlers('url')}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Footer</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Aparece al pie de todas las vistas</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={showPoweredBy}
            onClick={() => setShowPoweredBy(v => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${showPoweredBy ? 'bg-black' : 'bg-zinc-300'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${showPoweredBy ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
          <label className="text-sm font-medium cursor-pointer" onClick={() => setShowPoweredBy(v => !v)}>
            Mostrar "Desarrollado por {saasName || 'SaaS'}"
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block">Texto del footer</label>
          <input
            type="text"
            value={footerText}
            onChange={e => setFooterText(e.target.value)}
            placeholder="© 2026 GymOS. Todos los derechos reservados."
            disabled={isPending}
            className={inputClass}
            {...createHandlers('text')}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Links del footer</label>
            <button
              type="button"
              onClick={addLink}
              disabled={isPending || footerLinks.length >= 6}
              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-black transition-colors disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar link
            </button>
          </div>
          {footerLinks.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin links configurados</p>
          )}
          {footerLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={link.label}
                onChange={e => updateLink(i, 'label', e.target.value)}
                placeholder="Soporte"
                disabled={isPending}
                className={inputClass + ' flex-1'}
                {...createHandlers('text')}
              />
              <input
                type="text"
                value={link.url}
                onChange={e => updateLink(i, 'url', e.target.value)}
                placeholder="https://..."
                disabled={isPending}
                className={inputClass + ' flex-[2]'}
                {...createHandlers('url')}
              />
              <button
                type="button"
                onClick={() => removeLink(i)}
                disabled={isPending}
                className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <button
        type="submit"
        disabled={isPending || isUploading}
        className="rounded-xl bg-black px-6 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
      >
        {isPending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}
