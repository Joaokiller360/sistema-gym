'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Globe, MapPin, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { updateGymSettingsAction, uploadGymLogoAction } from './actions'
import { createHandlers } from '@/lib/input-validation'
import { useIntlLocale, useLocale, useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'
import { settingsMessages } from './messages'

const MAX_SIZE = 2 * 1024 * 1024

const CURRENCIES = [
  { value: 'USD' },
  { value: 'ARS' },
  { value: 'EUR' },
  { value: 'CLP' },
  { value: 'MXN' },
  { value: 'COP' },
  { value: 'PEN' },
  { value: 'BRL' },
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
  /** null = caller can't see/edit it (staff) */
  defaultWhatsapp: string | null
  countries: CountryOption[]
}

const inputClass = 'h-12 w-full rounded-xl border border-adm-line bg-adm-ground px-3.5 text-[15px] text-adm-ink outline-none transition-colors placeholder:text-adm-muted focus:border-adm-ink dark:focus:border-adm-brand disabled:opacity-50'
const labelClass = 'mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-adm-muted'
const cardClass = 'flex flex-col gap-[18px] rounded-[20px] border border-adm-line bg-adm-surface p-[22px]'
const saveClass = 'h-10 rounded-[10px] bg-adm-brand px-4 text-[13px] font-black text-adm-night transition-opacity hover:opacity-90 disabled:opacity-50'

function useClock(timezone: string, intlLocale: string) {
  // Client-only clock: starts empty so server and client markup match
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 30_000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [])
  if (now === null) return ''
  try {
    return new Date(now).toLocaleTimeString(intlLocale, { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
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
  defaultWhatsapp,
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
  const [whatsapp, setWhatsapp] = useState(defaultWhatsapp ? `+${defaultWhatsapp}` : '')
  const [loading, setLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, startUploadTransition] = useTransition()
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const t = useT(settingsMessages).form
  const tc = useT(commonMessages)
  const locale = useLocale()
  const intlLocale = useIntlLocale()
  const clock = useClock(timezone, intlLocale)
  // Backend labels are Spanish; in other languages let Intl name the country from its ISO code.
  const regionNames = locale === 'es' ? null : new Intl.DisplayNames([intlLocale], { type: 'region' })
  const countryLabel = (c: CountryOption) => {
    try { return regionNames?.of(c.code) ?? c.label } catch { return c.label }
  }

  function handleCountryChange(code: string) {
    setCountry(code)
    const found = countries.find(c => c.code === code)
    if (found) setTimezone(found.timezone)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  function uploadFile(file: File) {
    setUploadError(null)

    if (!file.type.startsWith('image/')) {
      setUploadError(t.onlyImages)
      return
    }
    if (file.size > MAX_SIZE) {
      setUploadError(t.tooBig)
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
        // The logo is already saved: refresh so the sidebar shows it
      }
    })
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
      ...(defaultWhatsapp !== null && { whatsappPhone: whatsapp.trim() || null }),
    }, gymId || undefined)

    setLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(tc.savedOk)
      if (result.newSlug && result.newSlug !== gymSlug) {
        window.location.href = `/gym/${result.newSlug}/settings`
      }
    }
  }

  const selectedCountry = countries.find(c => c.code === country)

  const saveButton = (
    <button type="submit" disabled={loading || isUploading} className={saveClass}>
      {loading ? tc.saving : tc.save}
    </button>
  )

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <section aria-labelledby="identity-h" className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="identity-h" className="text-[17px] font-extrabold">{t.identity}</h2>
          {saveButton}
        </div>

        <div>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex w-full items-center gap-4 rounded-2xl border-[1.5px] border-dashed bg-adm-ground p-4 text-left transition-colors disabled:opacity-60 ${
              dragging ? 'border-adm-ink dark:border-adm-brand' : 'border-adm-line hover:border-adm-muted'
            }`}
          >
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-adm-brand text-lg font-black text-adm-night">
              {logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logoUrl} alt={t.currentLogo} className="h-full w-full object-cover" />
                : initials(name || 'G')}
              {isUploading && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-bold text-white">…</span>}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-extrabold">{isUploading ? t.uploading : t.changeLogo}</span>
              <span className="text-[13px] text-adm-muted">{t.logoHint}</span>
            </span>
          </button>
          {uploadError && <p className="mt-2 text-xs font-medium text-adm-bad-fg">{uploadError}</p>}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        <div>
          <label htmlFor="gym-name" className={labelClass}>{t.name}</label>
          <input
            id="gym-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className={`${inputClass} font-bold`}
            {...createHandlers('text')}
          />
        </div>

        <div>
          <label htmlFor="gym-address" className={labelClass}>{t.address}</label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-muted" aria-hidden="true" />
            <input
              id="gym-address"
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder={t.addressPlaceholder}
              className={`${inputClass} pl-10`}
              {...createHandlers('address')}
            />
          </div>
        </div>

        {defaultWhatsapp !== null && (
          <div>
            <label htmlFor="gym-whatsapp" className={labelClass}>{t.whatsapp}</label>
            <div className="relative">
              <MessageCircle className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-adm-muted" aria-hidden="true" />
              <input
                id="gym-whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value.replace(/[^\d+\s-]/g, ''))}
                placeholder="+54 9 11 2233 4455"
                maxLength={20}
                aria-describedby="gym-whatsapp-hint"
                className={`${inputClass} pl-10 font-admin-mono`}
              />
            </div>
            <p id="gym-whatsapp-hint" className="mt-2 text-[13px] text-adm-muted">{t.whatsappHint}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="region-h" className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="region-h" className="text-[17px] font-extrabold">{t.region}</h2>
          {saveButton}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="gym-country" className={labelClass}>{t.country}</label>
            <select
              id="gym-country"
              value={country}
              onChange={e => handleCountryChange(e.target.value)}
              className={`${inputClass} font-semibold`}
            >
              <option value="">{t.selectCountry}</option>
              {countries.map(c => (
                <option key={c.code} value={c.code}>{countryLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gym-currency" className={labelClass}>{t.currency}</label>
            <select
              id="gym-currency"
              value={currency}
              onChange={e => setCurrency(e.target.value as typeof CURRENCIES[number]['value'])}
              className={`${inputClass} font-semibold`}
            >
              {CURRENCIES.map(c => (
                <option key={c.value} value={c.value}>{c.value} — {t.currencies[c.value]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3.5 rounded-[14px] border border-adm-line bg-adm-ground px-4 py-3.5">
          <Globe className="h-5 w-5 shrink-0 text-adm-muted" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-admin-mono text-sm font-bold">
              {timezone}{selectedCountry ? ` (${selectedCountry.utcOffset})` : ''}
            </span>
            <span className="text-[13px] text-adm-muted">{t.timezoneHint}</span>
          </div>
          {clock && <span className="font-admin-mono text-[22px] font-bold" aria-label={t.localTime(clock)}>{clock}</span>}
        </div>
      </section>
    </form>
  )
}
