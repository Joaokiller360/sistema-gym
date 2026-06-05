'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2, CalendarClock, ArrowRight, Calendar, Clock, User, Mail, Phone, Globe } from 'lucide-react'
import { createBlockHandlers } from '@/lib/input-validation'
import { submitAccessRequestAction } from './access-request-actions'

const nameHandlers = createBlockHandlers('name')
const emailHandlers = createBlockHandlers('email')
const phoneHandlers = createBlockHandlers('phone')
const callingCodeHandlers = createBlockHandlers('phone')

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 pl-9 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all disabled:opacity-50'

const selectClass =
  'w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 pl-9 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all disabled:opacity-50 appearance-none cursor-pointer'

const ALL_TIMES = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 2) + 8
  const m = i % 2 === 0 ? '00' : '30'
  if (h > 20) return null
  return `${String(h).padStart(2, '0')}:${m}`
}).filter(Boolean) as string[]

const COUNTRIES = [
  { code: 'AR', name: 'Argentina',       flag: '🇦🇷' },
  { code: 'MX', name: 'México',          flag: '🇲🇽' },
  { code: 'CO', name: 'Colombia',        flag: '🇨🇴' },
  { code: 'CL', name: 'Chile',           flag: '🇨🇱' },
  { code: 'PE', name: 'Perú',            flag: '🇵🇪' },
  { code: 'VE', name: 'Venezuela',       flag: '🇻🇪' },
  { code: 'EC', name: 'Ecuador',         flag: '🇪🇨' },
  { code: 'BO', name: 'Bolivia',         flag: '🇧🇴' },
  { code: 'PY', name: 'Paraguay',        flag: '🇵🇾' },
  { code: 'UY', name: 'Uruguay',         flag: '🇺🇾' },
  { code: 'BR', name: 'Brasil',          flag: '🇧🇷' },
  { code: 'CR', name: 'Costa Rica',      flag: '🇨🇷' },
  { code: 'PA', name: 'Panamá',          flag: '🇵🇦' },
  { code: 'DO', name: 'Rep. Dominicana', flag: '🇩🇴' },
  { code: 'GT', name: 'Guatemala',       flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras',        flag: '🇭🇳' },
  { code: 'SV', name: 'El Salvador',     flag: '🇸🇻' },
  { code: 'NI', name: 'Nicaragua',       flag: '🇳🇮' },
  { code: 'CU', name: 'Cuba',            flag: '🇨🇺' },
  { code: 'PR', name: 'Puerto Rico',     flag: '🇵🇷' },
  { code: 'ES', name: 'España',          flag: '🇪🇸' },
  { code: 'US', name: 'Estados Unidos',  flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá',          flag: '🇨🇦' },
  { code: 'PT', name: 'Portugal',        flag: '🇵🇹' },
  { code: 'FR', name: 'Francia',         flag: '🇫🇷' },
  { code: 'DE', name: 'Alemania',        flag: '🇩🇪' },
  { code: 'IT', name: 'Italia',          flag: '🇮🇹' },
  { code: 'GB', name: 'Reino Unido',     flag: '🇬🇧' },
  { code: 'AU', name: 'Australia',       flag: '🇦🇺' },
  { code: 'OTHER', name: 'Otro',         flag: '🌍' },
]

// Max chars per country — incluye 0 inicial donde aplica (EC:09X, PY:0981, UY:09X, FR:06X, GB:07X, AU:04X)
const COUNTRY_PHONE_MAX: Record<string, number> = {
  AR: 10, MX: 10, CO: 10, CL: 9,  PE: 9,  VE: 10,
  EC: 10, BO: 8,  PY: 10, UY: 9,  BR: 11, CR: 8,
  PA: 8,  DO: 10, GT: 8,  HN: 8,  SV: 8,  NI: 8,
  CU: 8,  PR: 10, ES: 9,  US: 10, CA: 10, PT: 9,
  FR: 10, DE: 11, IT: 10, GB: 11, AU: 10, OTHER: 15,
}

const COUNTRY_CALLING_CODE: Record<string, string> = {
  AR: '+54',
  MX: '+52',
  CO: '+57',
  CL: '+56',
  PE: '+51',
  VE: '+58',
  EC: '+593',
  BO: '+591',
  PY: '+595',
  UY: '+598',
  BR: '+55',
  CR: '+506',
  PA: '+507',
  DO: '+1',
  GT: '+502',
  HN: '+504',
  SV: '+503',
  NI: '+505',
  CU: '+53',
  PR: '+1',
  ES: '+34',
  US: '+1',
  CA: '+1',
  PT: '+351',
  FR: '+33',
  DE: '+49',
  IT: '+39',
  GB: '+44',
  AU: '+61',
  OTHER: '',
}

export function AccessRequestBanner({ primaryColor, availableSlots }: { primaryColor: string; availableSlots: string[] }) {
  const times = availableSlots.length > 0 ? availableSlots.sort() : ALL_TIMES
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('')
  const [callingCode, setCallingCode] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().slice(0, 10)

  function handleCountryChange(code: string) {
    setCountry(code)
    setCallingCode(COUNTRY_CALLING_CODE[code] ?? '')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!country) { setError('Seleccioná tu país'); return }
    if (!date || !time) { setError('Elegí fecha y hora'); return }
    setError('')
    const preferredDate = `${date}T${time}`
    startTransition(async () => {
      const res = await submitAccessRequestAction({
        name, email, phone, country,
        callingCode: callingCode || undefined,
        preferredDate,
      })
      if (res.error) setError(res.error)
      else setDone(true)
    })
  }

  return (
    <section id="acceso" className="relative bg-zinc-950 py-24 px-4 overflow-hidden">
      <div
        className="absolute top-1/2 right-0 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[160px] opacity-10 pointer-events-none"
        style={{ background: primaryColor }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:3rem_3rem]" />

      <div className="relative z-10 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left */}
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/50">
            <CalendarClock className="h-3.5 w-3.5" />
            Acceso anticipado
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight">
            Pedí tu<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}>
              acceso ahora
            </span>
          </h2>
          <p className="text-white/40 text-base leading-relaxed max-w-sm">
            Dejá tus datos y elegí el día y hora que mejor te queda. Te contactamos para darte acceso a la plataforma.
          </p>
          <div className="space-y-2.5 pt-2">
            {[
              'Configuración personalizada incluida',
              'Soporte dedicado en el onboarding',
              'Sin contratos largos',
            ].map(f => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-white/50">
                <span className="h-5 w-5 rounded-full flex items-center justify-center shrink-0" style={{ background: `${primaryColor}20`, border: `1px solid ${primaryColor}40` }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 2.5" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 sm:p-8">
          {done ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
              <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ background: `${primaryColor}20` }}>
                <CheckCircle2 className="h-7 w-7" style={{ color: primaryColor }} />
              </div>
              <div>
                <p className="text-white font-bold text-lg">¡Solicitud enviada!</p>
                <p className="text-white/40 text-sm mt-1">Te contactamos pronto para confirmar tu acceso.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                  Nombre completo *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    {...nameHandlers}
                    required
                    disabled={isPending}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    {...emailHandlers}
                    required
                    disabled={isPending}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Nationality + Calling Code */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                    Nacionalidad *
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none z-10" />
                    <select
                      value={country}
                      onChange={e => handleCountryChange(e.target.value)}
                      required
                      disabled={isPending}
                      className={selectClass}
                    >
                      <option value="" disabled>País</option>
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                    Extensión
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={country ? 'Cód. llamada' : 'Elegí tu país'}
                      value={callingCode}
                      onChange={e => setCallingCode(e.target.value)}
                      {...callingCodeHandlers}
                      disabled={!country || isPending}
                      maxLength={6}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                  Celular
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                  <input
                    type="tel"
                    placeholder={callingCode ? `${callingCode} 9 11 1234-5678` : '+54 9 11 1234-5678'}
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    {...phoneHandlers}
                    disabled={isPending}
                    maxLength={(COUNTRY_PHONE_MAX[country] ?? 15) + 4}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Date + Time */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                  Fecha y hora preferida *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
                    <input
                      type="date"
                      min={minDateStr}
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      required
                      disabled={isPending}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 pl-9 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all disabled:opacity-50 [color-scheme:dark]"
                    />
                  </div>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none z-10" />
                    <select
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      required
                      disabled={isPending}
                      className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 pl-9 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all disabled:opacity-50 appearance-none cursor-pointer"
                    >
                      <option value="" disabled>Hora</option>
                      {times.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-xs font-semibold pt-1">{error}</p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 mt-1"
                style={{ background: primaryColor, color: '#000' }}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Solicitar acceso
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
