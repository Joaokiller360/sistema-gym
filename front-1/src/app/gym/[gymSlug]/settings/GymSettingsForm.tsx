'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { updateGymSettingsAction, uploadGymLogoAction } from './actions'

const MAX_SIZE = 2 * 1024 * 1024

const CURRENCIES = [
  { value: 'USD', label: 'USD — Dólar' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'PEN', label: 'PEN — Sol peruano' },
  { value: 'BRL', label: 'BRL — Real brasileño' },
] as const

interface CountryOption {
  code: string
  label: string
  timezone: string
  utcOffset: string
}

interface Props {
  gymSlug: string
  gymId: string
  defaultName: string
  defaultLogoUrl: string | null
  defaultCurrency: string
  defaultAddress: string | null
  defaultCountry: string | null
  defaultTimezone: string
  countries: CountryOption[]
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export function GymSettingsForm({
  gymSlug,
  gymId,
  defaultName,
  defaultLogoUrl,
  defaultCurrency,
  defaultAddress,
  defaultCountry,
  defaultTimezone,
  countries,
}: Props) {
  const [name, setName] = useState(defaultName)
  const [logoUrl, setLogoUrl] = useState(defaultLogoUrl ?? '')
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]['value']>(
    (CURRENCIES.map(c => c.value) as string[]).includes(defaultCurrency) ? defaultCurrency as typeof CURRENCIES[number]['value'] : 'USD'
  )
  const [address, setAddress] = useState(defaultAddress ?? '')
  const [country, setCountry] = useState(defaultCountry ?? '')
  const [timezone, setTimezone] = useState(defaultTimezone || 'UTC')
  const [loading, setLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, startUploadTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleCountryChange(code: string) {
    setCountry(code)
    const found = countries.find(c => c.code === code)
    if (found) setTimezone(found.timezone)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)

    if (!file.type.startsWith('image/')) {
      setUploadError('Solo se permiten archivos de imagen')
      return
    }
    if (file.size > MAX_SIZE) {
      setUploadError('El archivo supera el límite de 2MB')
      return
    }

    const fd = new FormData()
    fd.append('logo', file)

    startUploadTransition(async () => {
      const res = await uploadGymLogoAction(gymId, gymSlug, fd)
      if (res.error) {
        toast.error(res.error)
      } else if (res.logoUrl) {
        setLogoUrl(res.logoUrl)
      }
    })

    e.target.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await updateGymSettingsAction(gymSlug, {
      name,
      logoUrl: logoUrl.trim() || null,
      currency,
      address: address.trim() || null,
      country: country || null,
      timezone: timezone || undefined,
    }, gymId || undefined)

    setLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Cambios guardados correctamente')
    }
  }

  const selectedCountry = countries.find(c => c.code === country)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Logo */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Logo</label>
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 rounded-2xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
              : <span className="text-xl font-black text-black">{initials(name || 'G')}</span>
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
              disabled={isUploading}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              {isUploading ? 'Subiendo…' : 'Cambiar logo'}
            </button>
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP, TIFF… · Máx. 2MB</p>
          </div>
        </div>
        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Nombre */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Nombre del gimnasio</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
        />
      </div>

      {/* Dirección */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Dirección</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Av. Principal 123, Ciudad"
            className="w-full rounded-md border pl-9 pr-3 py-2 text-sm bg-background"
          />
        </div>
      </div>

      {/* País + zona horaria */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">País</label>
        <select
          value={country}
          onChange={e => handleCountryChange(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
        >
          <option value="">— Seleccionar país —</option>
          {countries.map(c => (
            <option key={c.code} value={c.code}>
              {c.label} ({c.utcOffset})
            </option>
          ))}
        </select>
        {selectedCountry && (
          <p className="text-xs text-muted-foreground">
            Zona horaria: <span className="font-medium">{selectedCountry.timezone}</span> · {selectedCountry.utcOffset}
          </p>
        )}
        {!selectedCountry && timezone && timezone !== 'UTC' && (
          <p className="text-xs text-muted-foreground">Zona horaria actual: <span className="font-medium">{timezone}</span></p>
        )}
      </div>

      {/* Moneda */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Moneda</label>
        <select
          value={currency}
          onChange={e => setCurrency(e.target.value as typeof CURRENCIES[number]['value'])}
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
        >
          {CURRENCIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Se usará en planes, pagos y reportes del gimnasio.</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}
