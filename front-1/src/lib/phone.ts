export interface PhoneCountry {
  code: string
  name: string
  dial: string
  flag: string
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'AR', name: 'Argentina',       dial: '54',  flag: '🇦🇷' },
  { code: 'BO', name: 'Bolivia',         dial: '591', flag: '🇧🇴' },
  { code: 'BR', name: 'Brasil',          dial: '55',  flag: '🇧🇷' },
  { code: 'CL', name: 'Chile',           dial: '56',  flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia',        dial: '57',  flag: '🇨🇴' },
  { code: 'CR', name: 'Costa Rica',      dial: '506', flag: '🇨🇷' },
  { code: 'CU', name: 'Cuba',            dial: '53',  flag: '🇨🇺' },
  { code: 'EC', name: 'Ecuador',         dial: '593', flag: '🇪🇨' },
  { code: 'SV', name: 'El Salvador',     dial: '503', flag: '🇸🇻' },
  { code: 'GT', name: 'Guatemala',       dial: '502', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras',        dial: '504', flag: '🇭🇳' },
  { code: 'MX', name: 'México',          dial: '52',  flag: '🇲🇽' },
  { code: 'NI', name: 'Nicaragua',       dial: '505', flag: '🇳🇮' },
  { code: 'PA', name: 'Panamá',          dial: '507', flag: '🇵🇦' },
  { code: 'PY', name: 'Paraguay',        dial: '595', flag: '🇵🇾' },
  { code: 'PE', name: 'Perú',            dial: '51',  flag: '🇵🇪' },
  { code: 'PR', name: 'Puerto Rico',     dial: '1',   flag: '🇵🇷' },
  { code: 'DO', name: 'Rep. Dominicana', dial: '1',   flag: '🇩🇴' },
  { code: 'UY', name: 'Uruguay',         dial: '598', flag: '🇺🇾' },
  { code: 'VE', name: 'Venezuela',       dial: '58',  flag: '🇻🇪' },
  { code: 'US', name: 'Estados Unidos',  dial: '1',   flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá',          dial: '1',   flag: '🇨🇦' },
  { code: 'ES', name: 'España',          dial: '34',  flag: '🇪🇸' },
  { code: 'PT', name: 'Portugal',        dial: '351', flag: '🇵🇹' },
  { code: 'FR', name: 'Francia',         dial: '33',  flag: '🇫🇷' },
  { code: 'DE', name: 'Alemania',        dial: '49',  flag: '🇩🇪' },
  { code: 'IT', name: 'Italia',          dial: '39',  flag: '🇮🇹' },
  { code: 'GB', name: 'Reino Unido',     dial: '44',  flag: '🇬🇧' },
  { code: 'AU', name: 'Australia',       dial: '61',  flag: '🇦🇺' },
]

export const DEFAULT_PHONE_COUNTRY = 'EC'

// NANP countries share +1; the area code tells them apart
const NANP_AREAS: Record<string, string> = { '809': 'DO', '829': 'DO', '849': 'DO', '787': 'PR', '939': 'PR' }

export function phoneCountry(code: string | null | undefined): PhoneCountry {
  return (
    PHONE_COUNTRIES.find(c => c.code === code?.toUpperCase()) ??
    PHONE_COUNTRIES.find(c => c.code === DEFAULT_PHONE_COUNTRY)!
  )
}

/** Stored international number ("593986660737" or "+593…") → country + national part. */
export function splitPhone(raw: string | null | undefined, fallback?: string | null): { country: string; number: string } {
  const digits = (raw ?? '').replace(/\D/g, '')
  const fallbackCode = phoneCountry(fallback).code
  if (!digits) return { country: fallbackCode, number: '' }

  if (digits.startsWith('1')) {
    const byArea = NANP_AREAS[digits.slice(1, 4)]
    const code = byArea ?? (['US', 'CA'].includes(fallbackCode) ? fallbackCode : 'US')
    return { country: code, number: digits.slice(1) }
  }
  const match = PHONE_COUNTRIES
    .filter(c => c.dial !== '1' && digits.startsWith(c.dial))
    .sort((a, b) => b.dial.length - a.dial.length)[0]
  return match
    ? { country: match.code, number: digits.slice(match.dial.length) }
    : { country: fallbackCode, number: digits }
}

/** Country + number as typed locally → "+<dial><number>", or "" when empty. */
export function joinPhone(countryCode: string, number: string): string {
  const country = phoneCountry(countryCode)
  // Local trunk prefix: 099… in Ecuador is +593 99…
  let national = number.replace(/\D/g, '').replace(/^0+/, '')
  if (!national) return ''
  // WhatsApp needs the mobile 9 after +54
  if (country.code === 'AR' && !national.startsWith('9')) national = `9${national}`
  return `+${country.dial}${national}`
}
