'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check } from 'lucide-react'
import { createGymAction, uploadGymLogoAction, type CreateGymInput } from '../actions'
import type { SubscriptionPlan } from './page'

const PLAN_PALETTE = [
  { color: 'border-zinc-200', activeColor: 'border-black bg-black text-white' },
  { color: 'border-[#1fad9d]', activeColor: 'border-[#1fad9d] bg-[#1fad9d] text-white' },
  { color: 'border-[#fffb00]', activeColor: 'border-[#fffb00] bg-[#fffb00] text-black' },
]

function formatPrice(price: number, currency: string): string {
  if (price === 0) return 'Gratis'
  const symbol = currency === 'USD' ? '$' : currency
  return `${symbol}${price}/mes`
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">{label}</label>
      {children}
      {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}
    </div>
  )
}

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'

const MAX_SIZE = 2 * 1024 * 1024

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export function CreateGymForm({ plans }: { plans: SubscriptionPlan[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [plan, setPlan] = useState(() => plans[0]?.key ?? '')

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    if (!file.type.startsWith('image/')) {
      setLogoError('Solo se permiten archivos de imagen')
      return
    }
    if (file.size > MAX_SIZE) {
      setLogoError('El archivo supera 2MB')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')

  function handleNameChange(v: string) {
    setName(v)
    if (!slugManual) setSlug(toSlug(v))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Nombre requerido'
    if (!slug.trim()) e.slug = 'Slug requerido'
    if (!/^[a-z0-9-]+$/.test(slug)) e.slug = 'Solo minúsculas, números y guiones'
    if (!ownerName.trim()) e.ownerName = 'Nombre del dueño requerido'
    if (!ownerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) e.ownerEmail = 'Email inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setServerError(null)

    startTransition(async () => {
      const payload: CreateGymInput = {
        name,
        slug,
        subscriptionPlan: plan,
        owner: { name: ownerName, email: ownerEmail },
      }
      const result = await createGymAction(payload)
      if ('error' in result) {
        setServerError(result.error)
        return
      }

      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        await uploadGymLogoAction(result.gymId, fd)
      }

      router.push('/admin/gyms')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">

      {/* Gym info */}
      <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Información del gimnasio</h2>

        <Field label="Nombre del gimnasio" error={errors.name}>
          <input
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Ej. Fitness Club Centro"
            disabled={isPending}
            className={inputClass}
          />
        </Field>

        <Field label="Slug (URL)" error={errors.slug}>
          <div className="flex items-center">
            <span className="inline-flex h-10 items-center rounded-l-xl border border-r-0 border-zinc-200 bg-zinc-100 px-3 text-sm text-zinc-500 select-none">
              /gym/
            </span>
            <input
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugManual(true) }}
              placeholder="fitness-club-centro"
              disabled={isPending}
              className="flex-1 h-10 rounded-r-xl border border-zinc-200 bg-zinc-50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
            />
          </div>
        </Field>

        <Field label="Logo (opcional)" error={logoError ?? undefined}>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
              {logoPreview
                ? <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                : <span className="text-sm font-black text-black">{initials(name || 'G')}</span>
              }
            </div>
            <div className="space-y-1">
              <button
                type="button"
                disabled={isPending}
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300 transition-all disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
                {logoFile ? logoFile.name : 'Subir logo'}
              </button>
              <p className="text-xs text-zinc-400">PNG, JPG, WebP, TIFF… · Máx. 2MB</p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </Field>
      </section>

      {/* Owner */}
      <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Dueño del gimnasio</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre completo" error={errors.ownerName}>
            <input
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder="Juan Pérez"
              disabled={isPending}
              className={inputClass}
            />
          </Field>

          <Field label="Email" error={errors.ownerEmail}>
            <input
              type="email"
              value={ownerEmail}
              onChange={e => setOwnerEmail(e.target.value)}
              placeholder="juan@email.com"
              disabled={isPending}
              className={inputClass}
            />
          </Field>
        </div>

        <p className="text-xs text-zinc-400 bg-zinc-50 rounded-xl px-4 py-3 border border-zinc-200">
          Se generará una contraseña temporal automáticamente y se enviará al correo del dueño.
        </p>
      </section>

      {/* Plan comparison */}
      <section className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Plan de suscripción</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((p, i) => {
            const selected = plan === p.key
            const palette = PLAN_PALETTE[i % PLAN_PALETTE.length]
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPlan(p.key)}
                className={`rounded-2xl border-2 p-4 text-left transition-all ${
                  selected ? palette.activeColor : `${palette.color} hover:shadow-sm`
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-black text-base">{p.label}</p>
                  <p className="text-sm font-bold">{formatPrice(p.price, p.currency)}</p>
                </div>
                {p.maxMembers !== null && (
                  <p className="text-xs mb-3 opacity-60">Hasta {p.maxMembers} miembros</p>
                )}
                {p.maxMembers === null && (
                  <p className="text-xs mb-3 opacity-60">Miembros ilimitados</p>
                )}
                <ul className="space-y-1.5">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      </section>

      {serverError && (
        <div className="rounded-xl bg-[#ff0000]/8 border border-[#ff0000]/20 px-4 py-3 text-sm text-[#cc0000] font-medium">
          {serverError}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-black px-6 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
        >
          {isPending ? 'Creando…' : 'Crear gimnasio'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/gyms')}
          className="rounded-xl border border-zinc-200 px-6 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
