'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, CheckCircle2, Loader2 } from 'lucide-react'
import { createBlockHandlers } from '@/lib/input-validation'
import { submitDemoRequestAction } from './demo-actions'
import { registerAction } from './register-action'

const nameHandlers = createBlockHandlers('name')
const emailHandlers = createBlockHandlers('email')
const textHandlers = createBlockHandlers('text')

const inputClass =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all placeholder:text-zinc-400 disabled:opacity-50'

interface Props {
  open: boolean
  onClose: () => void
  plan: { id: string; label: string; demoEnabled?: boolean }
  primaryColor: string
}

const COUNTRIES = [
  { code: 'AR', name: 'Argentina',          dial: '54',   flag: '🇦🇷' },
  { code: 'MX', name: 'México',             dial: '52',   flag: '🇲🇽' },
  { code: 'CO', name: 'Colombia',           dial: '57',   flag: '🇨🇴' },
  { code: 'CL', name: 'Chile',              dial: '56',   flag: '🇨🇱' },
  { code: 'PE', name: 'Perú',               dial: '51',   flag: '🇵🇪' },
  { code: 'UY', name: 'Uruguay',            dial: '598',  flag: '🇺🇾' },
  { code: 'PY', name: 'Paraguay',           dial: '595',  flag: '🇵🇾' },
  { code: 'BO', name: 'Bolivia',            dial: '591',  flag: '🇧🇴' },
  { code: 'EC', name: 'Ecuador',            dial: '593',  flag: '🇪🇨' },
  { code: 'VE', name: 'Venezuela',          dial: '58',   flag: '🇻🇪' },
  { code: 'BR', name: 'Brasil',             dial: '55',   flag: '🇧🇷' },
  { code: 'US', name: 'Estados Unidos',     dial: '1',    flag: '🇺🇸' },
  { code: 'CA', name: 'Canadá',             dial: '1',    flag: '🇨🇦' },
  { code: 'ES', name: 'España',             dial: '34',   flag: '🇪🇸' },
  { code: 'PT', name: 'Portugal',           dial: '351',  flag: '🇵🇹' },
  { code: 'GT', name: 'Guatemala',          dial: '502',  flag: '🇬🇹' },
  { code: 'SV', name: 'El Salvador',        dial: '503',  flag: '🇸🇻' },
  { code: 'HN', name: 'Honduras',           dial: '504',  flag: '🇭🇳' },
  { code: 'NI', name: 'Nicaragua',          dial: '505',  flag: '🇳🇮' },
  { code: 'CR', name: 'Costa Rica',         dial: '506',  flag: '🇨🇷' },
  { code: 'PA', name: 'Panamá',             dial: '507',  flag: '🇵🇦' },
  { code: 'DO', name: 'Rep. Dominicana',    dial: '1809', flag: '🇩🇴' },
  { code: 'CU', name: 'Cuba',              dial: '53',   flag: '🇨🇺' },
  { code: 'PR', name: 'Puerto Rico',        dial: '1787', flag: '🇵🇷' },
]

const DIAL_TO_CODE: Record<string, string> = {
  '54': 'AR', '52': 'MX', '57': 'CO', '56': 'CL', '51': 'PE',
  '598': 'UY', '595': 'PY', '591': 'BO', '593': 'EC', '58': 'VE',
  '55': 'BR', '1': 'US', '34': 'ES', '351': 'PT', '502': 'GT',
  '503': 'SV', '504': 'HN', '505': 'NI', '506': 'CR', '507': 'PA',
  '1809': 'DO', '53': 'CU', '1787': 'PR',
}

const CODE_TO_DIAL: Record<string, string> = {
  AR: '54', MX: '52', CO: '57', CL: '56', PE: '51', UY: '598',
  PY: '595', BO: '591', EC: '593', VE: '58', BR: '55', US: '1',
  CA: '1', ES: '34', PT: '351', GT: '502', SV: '503', HN: '504',
  NI: '505', CR: '506', PA: '507', DO: '1809', CU: '53', PR: '1787',
}

function PhoneInput({
  dial,
  onDialChange,
  number,
  onNumberChange,
  disabled,
}: {
  dial: string
  onDialChange: (v: string) => void
  number: string
  onNumberChange: (v: string) => void
  disabled?: boolean
}) {
  const selected = COUNTRIES.find(c => c.dial === dial) ?? COUNTRIES[0]

  return (
    <div className="flex gap-2">
      <select
        value={dial}
        onChange={e => onDialChange(e.target.value)}
        disabled={disabled}
        className="rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50 appearance-none shrink-0 w-[90px] text-center cursor-pointer"
        title="País"
      >
        {COUNTRIES.map(c => (
          <option key={c.code} value={c.dial}>
            {c.flag} +{c.dial}
          </option>
        ))}
      </select>

      <div className="flex-1 relative">
        <input
          type="tel"
          inputMode="numeric"
          value={number}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 10)
            onNumberChange(v)
          }}
          disabled={disabled}
          className={inputClass}
          placeholder={`Nº ${selected.name}`}
          maxLength={10}
        />
        {number.length > 0 && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-300 font-mono select-none">
            {number.length}/10
          </span>
        )}
      </div>
    </div>
  )
}

function RegisterForm({
  plan,
  primaryColor,
  onClose,
}: {
  plan: Props['plan']
  primaryColor: string
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneDial, setPhoneDial] = useState('54')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [gymName, setGymName] = useState('')
  const [country, setCountry] = useState('AR')

  function handleDialChange(dial: string) {
    setPhoneDial(dial)
    const code = DIAL_TO_CODE[dial]
    if (code) setCountry(code)
  }

  function handleCountryChange(code: string) {
    setCountry(code)
    const dial = CODE_TO_DIAL[code]
    if (dial) setPhoneDial(dial)
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const phone = phoneNumber ? `+${phoneDial}${phoneNumber}` : undefined
      const res = await registerAction({
        ownerName,
        email,
        phone,
        gymName,
        country: country || undefined,
        planId: plan.id,
        isTrial: true,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      onClose()
      if (res.gymSlug) {
        router.push(`/gym/${res.gymSlug}/dashboard`)
      } else {
        router.push('/login')
      }
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
          Tu nombre *
        </label>
        <input
          value={ownerName}
          onChange={e => setOwnerName(e.target.value)}
          className={inputClass}
          placeholder="Juan Pérez"
          disabled={isPending}
          autoFocus
          {...nameHandlers}
        />
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
          Email *
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={inputClass}
          placeholder="juan@ejemplo.com"
          disabled={isPending}
          {...emailHandlers}
        />
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
          Nombre del gimnasio *
        </label>
        <input
          value={gymName}
          onChange={e => setGymName(e.target.value)}
          className={inputClass}
          placeholder="Mi Gimnasio"
          disabled={isPending}
          {...textHandlers}
        />
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1.5">
          País
        </label>
        <select
          value={country}
          onChange={e => handleCountryChange(e.target.value)}
          disabled={isPending}
          className={inputClass}
        >
          <option value="">— Seleccionar país —</option>
          <option value="AR">Argentina (UTC-3)</option>
          <option value="BO">Bolivia (UTC-4)</option>
          <option value="BR">Brasil (UTC-3)</option>
          <option value="CL">Chile (UTC-4)</option>
          <option value="CO">Colombia (UTC-5)</option>
          <option value="EC">Ecuador (UTC-5)</option>
          <option value="PY">Paraguay (UTC-4)</option>
          <option value="PE">Perú (UTC-5)</option>
          <option value="UY">Uruguay (UTC-3)</option>
          <option value="VE">Venezuela (UTC-4)</option>
          <option value="CR">Costa Rica (UTC-6)</option>
          <option value="CU">Cuba (UTC-5)</option>
          <option value="DO">República Dominicana (UTC-4)</option>
          <option value="GT">Guatemala (UTC-6)</option>
          <option value="HN">Honduras (UTC-6)</option>
          <option value="MX">México (UTC-6)</option>
          <option value="NI">Nicaragua (UTC-6)</option>
          <option value="PA">Panamá (UTC-5)</option>
          <option value="SV">El Salvador (UTC-6)</option>
          <option value="PR">Puerto Rico (UTC-4)</option>
          <option value="US">Estados Unidos (Este) (UTC-5)</option>
          <option value="CA">Canadá (Este) (UTC-5)</option>
          <option value="ES">España (UTC+1)</option>
          <option value="PT">Portugal (UTC+0)</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
          Teléfono
        </label>
        <PhoneInput
          dial={phoneDial}
          onDialChange={handleDialChange}
          number={phoneNumber}
          onNumberChange={setPhoneNumber}
          disabled={isPending}
        />
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-500">
        <span className="font-semibold text-zinc-700">Plan:</span>
        {plan.label}
      </div>

      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full rounded-xl py-3 text-sm font-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: primaryColor, color: '#000' }}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isPending ? 'Creando cuenta…' : 'Crear cuenta gratis'}
      </button>

      <p className="text-center text-xs text-zinc-400">
        Al registrarte aceptás nuestros{' '}
        <a href="/terminos" target="_blank" className="underline hover:text-zinc-600 transition-colors">
          términos y condiciones
        </a>
      </p>
    </div>
  )
}

function DemoForm({
  plan,
  primaryColor,
  onSuccess,
}: {
  plan: Props['plan']
  primaryColor: string
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneDial, setPhoneDial] = useState('54')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [gymName, setGymName] = useState('')

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const phone = phoneNumber ? `+${phoneDial}${phoneNumber}` : undefined
      const res = await submitDemoRequestAction({
        name, email, phone, gymName,
        planId: plan.id, planLabel: plan.label,
      })
      if (res.error) setError(res.error)
      else onSuccess()
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
          Nombre completo *
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className={inputClass}
          placeholder="Juan Pérez"
          autoFocus
          {...nameHandlers}
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
          Email *
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={inputClass}
          placeholder="juan@ejemplo.com"
          {...emailHandlers}
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
          Nombre del gimnasio *
        </label>
        <input
          value={gymName}
          onChange={e => setGymName(e.target.value)}
          className={inputClass}
          placeholder="Mi Gimnasio"
          {...textHandlers}
        />
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">
          Teléfono
        </label>
        <PhoneInput
          dial={phoneDial}
          onDialChange={setPhoneDial}
          number={phoneNumber}
          onNumberChange={setPhoneNumber}
        />
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full rounded-xl py-3 text-sm font-black transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: primaryColor, color: '#000' }}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isPending ? 'Enviando…' : 'Solicitar demo'}
      </button>
    </div>
  )
}

export function DemoRequestModal({ open, onClose, plan, primaryColor }: Props) {
  const [tab, setTab] = useState<'register' | 'demo'>('register')
  const [demoSuccess, setDemoSuccess] = useState(false)

  useEffect(() => {
    if (!open) {
      setTab('register')
      setDemoSuccess(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[95svh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-5 pb-3 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-zinc-200 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-500">
              Plan {plan.label}
            </span>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-700">
              1 mes de prueba gratis
            </span>
          </div>
          <h2 className="text-lg font-black text-zinc-900">Probá {plan.label} sin costo</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Acceso completo por 30 días. Luego podés continuar o cancelar.</p>
        </div>

        {plan.demoEnabled && !demoSuccess && (
          <div className="flex gap-1 px-5 pt-4 pb-0 shrink-0">
            <button
              onClick={() => setTab('register')}
              className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all ${tab === 'register' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              Registrarse
            </button>
            <button
              onClick={() => setTab('demo')}
              className="flex-1 rounded-xl py-2 text-sm font-bold transition-all"
              style={tab === 'demo' ? { background: primaryColor, color: '#000' } : { color: '#71717a' }}
            >
              Solicitar demo
            </button>
          </div>
        )}

        <div className="p-5 pt-4 overflow-y-auto">
          {demoSuccess ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" strokeWidth={1.5} />
              <p className="font-black text-zinc-900 text-lg">¡Solicitud enviada!</p>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Recibimos tu solicitud de demo para el plan <strong>{plan.label}</strong>.{' '}
                Nos pondremos en contacto a la brevedad.
              </p>
              <button
                onClick={onClose}
                className="mt-4 rounded-xl border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
              >
                Cerrar
              </button>
            </div>
          ) : tab === 'register' || !plan.demoEnabled ? (
            <RegisterForm plan={plan} primaryColor={primaryColor} onClose={onClose} />
          ) : (
            <DemoForm plan={plan} primaryColor={primaryColor} onSuccess={() => setDemoSuccess(true)} />
          )}
        </div>
      </div>
    </div>
  )
}
