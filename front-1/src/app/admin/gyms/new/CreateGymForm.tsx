'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Camera, Check } from 'lucide-react'
import { createGymAction, uploadGymLogoAction, registerSubscriptionPaymentAction, type CreateGymInput } from '../actions'
import { createHandlers } from '@/lib/input-validation'
import { cn } from '@/lib/utils'
import { btn, field, initials } from '@/components/admin/ui'
import { PhoneInput } from '@/components/shared/PhoneInput'
import type { SubscriptionPlan } from './page'

const METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'OTHER', label: 'Otro' },
] as const

type Method = (typeof METHODS)[number]['value']

function formatPrice(price: number, currency: string): string {
  if (price === 0) return 'Gratis'
  return `${currency} ${price.toLocaleString('es-AR')}`
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function Field({ label, htmlFor, error, hint, children, className }: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 flex-1 basis-60', className)}>
      <label htmlFor={htmlFor} className={field.label}>{label}</label>
      {children}
      {error ? <p className={field.error}>{error}</p> : hint ? <p className={field.hint}>{hint}</p> : null}
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-adm-line bg-adm-surface p-6">
      <h2 className="mb-5 flex items-center gap-3 text-[17px] font-bold">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-adm-ink text-[13px] font-extrabold text-adm-surface">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

const MAX_SIZE = 2 * 1024 * 1024

const todayYM = new Date().toISOString().slice(0, 7)

function monthToNote(ym: string) {
  const [y, m] = ym.split('-')
  const name = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-AR', { month: 'long' })
  return `Pago mensual ${name} ${y}`
}

export function CreateGymForm({ plans, onSuccess }: { plans: SubscriptionPlan[]; onSuccess?: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [plan, setPlan] = useState(() => plans[0]?.key ?? '')

  const [payMethod, setPayMethod] = useState<Method>('CASH')
  const [payMonth, setPayMonth] = useState(todayYM)

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
  const [ownerPhone, setOwnerPhone] = useState('')

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
    const phoneDigits = ownerPhone.replace(/\D/g, '')
    if (ownerPhone.trim() && (phoneDigits.length < 8 || phoneDigits.length > 15)) e.ownerPhone = 'Número inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const selectedPlanObj = plans.find(p => p.key === plan)
  const isPaidPlan = (selectedPlanObj?.price ?? 0) > 0

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
        whatsappPhone: ownerPhone.trim() || null,
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

      if (isPaidPlan && selectedPlanObj) {
        const payResult = await registerSubscriptionPaymentAction(result.gymId, {
          amount: selectedPlanObj.price,
          currency: selectedPlanObj.currency as 'USD' | 'ARS' | 'EUR',
          method: payMethod,
          notes: monthToNote(payMonth),
        })
        if (payResult.error) {
          setServerError(`Gimnasio creado. Error al registrar pago inicial: ${payResult.error}`)
          router.push(`/admin/gyms/${result.gymId}`)
          return
        }
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/admin/gyms')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-4" noValidate>
      <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-4">
        <Step n={1} title="Información del gimnasio">
          <div className="flex flex-wrap gap-4">
            <Field label="Nombre" htmlFor="gym-name" error={errors.name}>
              <input
                id="gym-name"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="Ej. Fitness Club Centro"
                disabled={isPending}
                className={field.input}
                {...createHandlers('text')}
              />
            </Field>
            <Field label="Slug" htmlFor="gym-slug" error={errors.slug} hint="Se genera desde el nombre. Solo minúsculas y guiones.">
              <div className="flex overflow-hidden rounded-[10px] border border-adm-line bg-adm-surface focus-within:border-adm-ink">
                <span className="flex select-none items-center border-r border-adm-line bg-adm-subtle px-2.5 font-admin-mono text-xs text-adm-muted">/gym/</span>
                <input
                  id="gym-slug"
                  value={slug}
                  onChange={e => { setSlug(e.target.value); setSlugManual(true) }}
                  placeholder="fitness-club-centro"
                  disabled={isPending}
                  className="min-h-[42px] min-w-0 flex-1 bg-transparent px-2.5 font-admin-mono text-sm focus:outline-none"
                  {...createHandlers('slug')}
                />
              </div>
            </Field>
          </div>

          <div className="mt-4">
            <span className={field.label}>Logo (opcional)</span>
            <div className="flex flex-wrap items-center gap-4 rounded-xl border-[1.5px] border-dashed border-adm-line bg-adm-subtle p-4">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-adm-night/15 bg-adm-brand text-lg font-black text-adm-night">
                {logoPreview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoPreview} alt="Vista previa del logo" className="size-full object-cover" />
                  : initials(name || 'G')}
              </div>
              <div className="min-w-0 flex-[1_1_200px]">
                <p className="text-sm font-semibold">{logoFile ? logoFile.name : 'Sin logo se usan las iniciales'}</p>
                <p className="mt-0.5 text-xs text-adm-muted">PNG, JPG, WebP, TIFF… · Máx. 2MB</p>
                {logoError && <p className={field.error}>{logoError}</p>}
              </div>
              <button type="button" disabled={isPending} onClick={() => fileRef.current?.click()} className={btn.line}>
                <Camera className="size-3.5" aria-hidden="true" />
                {logoFile ? 'Cambiar logo' : 'Subir logo'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        </Step>

        <Step n={2} title="Dueño del gimnasio">
          <div className="flex flex-wrap gap-4">
            <Field label="Nombre completo" htmlFor="owner-name" error={errors.ownerName}>
              <input
                id="owner-name"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                placeholder="Juan Pérez"
                disabled={isPending}
                className={field.input}
                {...createHandlers('name')}
              />
            </Field>
            <Field label="Email" htmlFor="owner-email" error={errors.ownerEmail}>
              <input
                id="owner-email"
                type="email"
                value={ownerEmail}
                onChange={e => setOwnerEmail(e.target.value)}
                placeholder="juan@email.com"
                disabled={isPending}
                className={field.input}
                {...createHandlers('email')}
              />
            </Field>
            <Field label="WhatsApp (opcional)" htmlFor="owner-phone" error={errors.ownerPhone} hint="Elegí el país y escribí el número. Recibe los avisos de límite del plan.">
              <PhoneInput
                id="owner-phone"
                onChange={setOwnerPhone}
                disabled={isPending}
                selectClassName={field.input}
                inputClassName={field.input}
              />
            </Field>
          </div>
          <p className="mt-4 rounded-[10px] border border-adm-line-soft bg-adm-subtle px-4 py-3 text-[13px] text-adm-muted">
            Se genera una contraseña temporal y se envía al correo del dueño.
          </p>
        </Step>

        <Step n={3} title="Plan de suscripción">
          {plans.length === 0 ? (
            <p className="text-sm text-adm-muted">No hay planes activos. Creá uno en <Link href="/admin/plans" className={btn.link}>Planes</Link>.</p>
          ) : (
            <div role="radiogroup" aria-label="Plan" className="flex flex-wrap gap-3">
              {plans.map(p => {
                const selected = plan === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPlan(p.key)}
                    className={cn(
                      'flex min-w-0 flex-1 basis-52 flex-col gap-1.5 rounded-xl bg-adm-surface p-4 text-left transition-colors',
                      selected ? 'border-2 border-adm-ink bg-[#fffde0] p-[15px] dark:bg-[#24230f]' : 'border border-adm-line hover:border-adm-ink',
                    )}
                  >
                    <span className="font-admin-mono text-[11px] font-bold tracking-[0.08em] text-adm-muted">{p.key}</span>
                    <span className="text-lg font-extrabold">{p.label}</span>
                    <span className="font-admin-mono text-[15px] font-bold">
                      {formatPrice(p.price, p.currency)}
                      {p.price > 0 && <span className="text-xs font-medium text-adm-muted"> / mes</span>}
                    </span>
                    <span className="text-[13px] text-adm-muted">
                      {p.maxMembers !== null ? `Hasta ${p.maxMembers} miembros` : 'Miembros ilimitados'}
                    </span>
                    {p.features.length > 0 && (
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {p.features.map(f => (
                          <li key={f} className="flex items-start gap-1.5 text-xs">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-adm-ok-fg" aria-hidden="true" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Step>

        {isPaidPlan && selectedPlanObj && (
          <Step n={4} title="Pago inicial">
            <span className={field.label} id="pay-method-label">Método de pago</span>
            <div role="radiogroup" aria-labelledby="pay-method-label" className="flex flex-wrap gap-2">
              {METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={payMethod === m.value}
                  onClick={() => setPayMethod(m.value)}
                  disabled={isPending}
                  className={cn(
                    'min-h-10 rounded-lg border px-3.5 text-[13px] font-semibold transition-colors',
                    payMethod === m.value
                      ? 'border-adm-ink bg-adm-ink text-adm-surface'
                      : 'border-adm-line bg-adm-surface hover:border-adm-ink',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4">
              <Field label="Mes que cubre" htmlFor="pay-month" hint={monthToNote(payMonth)}>
                <input
                  id="pay-month"
                  type="month"
                  value={payMonth}
                  onChange={e => setPayMonth(e.target.value)}
                  disabled={isPending}
                  className={field.input}
                />
              </Field>
            </div>
          </Step>
        )}
      </div>

      <aside aria-label="Resumen" className="flex min-w-0 flex-[1_1_300px] flex-col gap-1 rounded-2xl border border-adm-line bg-adm-surface p-6">
        <h2 className="mb-2.5 text-[15px] font-bold">Resumen</h2>
        {([
          ['Gimnasio', name || '—'],
          ['Plan', selectedPlanObj?.label ?? '—'],
          ['Límite', selectedPlanObj ? (selectedPlanObj.maxMembers !== null ? `Hasta ${selectedPlanObj.maxMembers} miembros` : 'Ilimitado') : '—'],
          ...(isPaidPlan ? [['Método', METHODS.find(m => m.value === payMethod)?.label ?? '—']] : []),
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-adm-line-soft py-2.5 text-sm">
            <span className="text-adm-muted">{k}</span>
            <span className="truncate font-semibold">{v}</span>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 pb-2 pt-4">
          <span className="font-bold">Total a cobrar hoy</span>
          <span className="font-admin-mono text-2xl font-bold">
            {selectedPlanObj ? formatPrice(isPaidPlan ? selectedPlanObj.price : 0, selectedPlanObj.currency) : '—'}
          </span>
        </div>

        {serverError && (
          <div role="alert" className="my-2 rounded-[10px] border border-adm-bad-line bg-adm-bad-bg px-3.5 py-3 text-[13px] font-medium text-adm-bad-fg">
            {serverError}
          </div>
        )}

        <button type="submit" disabled={isPending || !plan} className={cn(btn.primary, 'min-h-12 text-[15px] font-extrabold')}>
          {isPending ? 'Creando…' : 'Crear gimnasio'}
        </button>
        <button
          type="button"
          onClick={() => (onSuccess ? onSuccess() : router.push('/admin/gyms'))}
          className={cn(btn.line, 'mt-2 min-h-11 text-sm')}
        >
          Cancelar
        </button>
      </aside>
    </form>
  )
}
