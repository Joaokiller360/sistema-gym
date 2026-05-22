'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2, Check, Star, Zap } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { createPlanAction, updatePlanAction } from './actions'

const ONLY_LETTERS_NUMBERS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s]+$/
const ALLOWED_CHAR = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9\s]$/

function blockInvalidChar(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key.length === 1 && !ALLOWED_CHAR.test(e.key)) e.preventDefault()
}

function blockInvalidPaste(e: React.ClipboardEvent<HTMLInputElement>) {
  const text = e.clipboardData.getData('text')
  if (!ONLY_LETTERS_NUMBERS.test(text)) e.preventDefault()
}

const formSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(100, 'No se puede poner más de 100 caracteres').refine(
    v => ONLY_LETTERS_NUMBERS.test(v),
    'Solo se permiten letras y números',
  ),
  price: z.number({ message: 'Precio inválido' }).min(0).max(999, 'No se puede poner más de 3 caracteres'),
  currency: z.string().min(1),
  durationDays: z.number({ message: 'Duración inválida' }).int().min(1).max(100, 'Máximo 100 días'),
  daysPerWeek: z.string().min(1),
  benefits: z.array(z.object({
    value: z.string().refine(
      v => v === '' || ONLY_LETTERS_NUMBERS.test(v),
      'Solo se permiten letras y números',
    ),
  })),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  storeEnabled: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

const DURATION_PRESETS = [
  { days: 30, label: '1 mes' },
  { days: 60, label: '2 meses' },
  { days: 90, label: '3 meses' },
  { days: 180, label: '6 meses' },
  { days: 365, label: '1 año' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'ARS', label: 'ARS', symbol: '$' },
  { value: 'BRL', label: 'BRL', symbol: 'R$' },
  { value: 'CLP', label: 'CLP', symbol: '$' },
  { value: 'MXN', label: 'MXN', symbol: '$' },
  { value: 'EUR', label: 'EUR', symbol: '€' },
]

const DAYS_OPTIONS = [
  { value: '1', label: '1×/sem' },
  { value: '2', label: '2×/sem' },
  { value: '3', label: '3×/sem' },
  { value: '4', label: '4×/sem' },
  { value: '5', label: '5×/sem' },
  { value: '6', label: '6×/sem' },
  { value: '7', label: 'Diario' },
  { value: 'unlimited', label: 'Ilimitado' },
]

interface PlanFormProps {
  gymSlug: string
  planId?: string
  defaultValues?: Partial<FormValues>
  onSuccess?: () => void
  onClose?: () => void
  showPreview?: boolean
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-500 font-medium mt-1">{msg}</p>
}

export function PlanForm({ gymSlug, planId, defaultValues, onSuccess, onClose, showPreview = true }: PlanFormProps) {
  const router = useRouter()
  const isEdit = !!planId
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      price: 0,
      currency: 'USD',
      durationDays: 30,
      daysPerWeek: 'unlimited',
      benefits: [],
      isActive: true,
      isFeatured: false,
      storeEnabled: false,
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'benefits' })

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = isEdit
        ? await updatePlanAction(gymSlug, planId!, values)
        : await createPlanAction(gymSlug, values)
      if (result?.error) {
        setServerError(result.error)
        return
      }
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/gym/${gymSlug}/plans`)
      }
    })
  }

  const name = watch('name')
  const price = watch('price')
  const currency = watch('currency')
  const durationDays = watch('durationDays')
  const daysPerWeek = watch('daysPerWeek')
  const benefits = watch('benefits')
  const isActive = watch('isActive')
  const isFeatured = watch('isFeatured')
  const storeEnabled = watch('storeEnabled')

  const currencySymbol = CURRENCIES.find(c => c.value === currency)?.symbol ?? '$'
  const daysLabel = DAYS_OPTIONS.find(d => d.value === daysPerWeek)?.label ?? daysPerWeek
  const durationPreset = DURATION_PRESETS.find(p => p.days === durationDays)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={showPreview ? 'grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start' : 'space-y-4'}>

      {/* ── LEFT: fields ── */}
      <div className="space-y-4">

        {/* Name */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nombre del plan</p>
          <input
            placeholder="Ej. Plan Full Access"
            disabled={isPending}
            {...register('name')}
            onKeyDown={blockInvalidChar}
            onPaste={blockInvalidPaste}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1fad9d] focus:border-transparent disabled:opacity-50 transition-all font-semibold"
          />
          <FieldError msg={errors.name?.message} />
        </div>

        {/* Price + currency */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Precio mensual</p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400 pointer-events-none select-none">
                {currencySymbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                maxLength={3}
                disabled={isPending}
                {...register('price', { setValueAs: v => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0 })}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d] focus:border-transparent disabled:opacity-50 transition-all font-semibold"
              />
            </div>
            <Controller
              control={control}
              name="currency"
              render={({ field }) => (
                <select
                  value={field.value}
                  onChange={e => field.onChange(e.target.value)}
                  disabled={isPending}
                  className="w-28 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1fad9d] focus:border-transparent disabled:opacity-50 transition-all appearance-none cursor-pointer text-center"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              )}
            />
          </div>
          <FieldError msg={errors.price?.message} />
        </div>

        {/* Duration */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Duración</p>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map(p => (
              <button
                key={p.days}
                type="button"
                onClick={() => setValue('durationDays', p.days)}
                className={cn(
                  'rounded-xl border px-4 py-2 text-sm font-semibold transition-all',
                  durationDays === p.days
                    ? 'border-[#1fad9d] bg-[#1fad9d]/10 text-[#1fad9d]'
                    : 'border-zinc-200 text-zinc-500 hover:border-zinc-300',
                )}
              >
                {p.label}
              </button>
            ))}
            <div className="relative">
              <input
                type="number"
                min="1"
                max="100"
                disabled={isPending}
                {...register('durationDays', { valueAsNumber: true })}
                placeholder="Días"
                className={cn(
                  'w-24 rounded-xl border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 transition-all bg-zinc-50',
                  errors.durationDays
                    ? 'border-red-400 text-red-500 focus:ring-red-400'
                    : !DURATION_PRESETS.find(p => p.days === durationDays)
                      ? 'border-[#1fad9d] text-[#1fad9d] focus:ring-[#1fad9d]'
                      : 'border-zinc-200 text-zinc-500 focus:ring-[#1fad9d]',
                )}
              />
            </div>
          </div>
          <FieldError msg={errors.durationDays?.message} />
        </div>

        {/* Days per week */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Días por semana</p>
          <div className="flex flex-wrap gap-2">
            {DAYS_OPTIONS.map(o => (
              <Controller
                key={o.value}
                control={control}
                name="daysPerWeek"
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(o.value)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm font-semibold transition-all',
                      field.value === o.value
                        ? 'border-[#1fad9d] bg-[#1fad9d]/10 text-[#1fad9d]'
                        : 'border-zinc-200 text-zinc-500 hover:border-zinc-300',
                    )}
                  >
                    {o.label}
                  </button>
                )}
              />
            ))}
          </div>
          <FieldError msg={errors.daysPerWeek?.message} />
        </div>

        {/* Benefits */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Beneficios</p>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-center">
                <div className="h-6 w-6 rounded-full bg-[#1fad9d]/10 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3 text-[#1fad9d]" />
                </div>
                <input
                  placeholder={`Beneficio ${index + 1}`}
                  disabled={isPending}
                  {...register(`benefits.${index}.value`)}
                  onKeyDown={blockInvalidChar}
                  onPaste={blockInvalidPaste}
                  className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1fad9d] focus:border-transparent disabled:opacity-50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 hover:border-red-200 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => append({ value: '' })}
              className="flex items-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-400 hover:border-[#1fad9d] hover:text-[#1fad9d] transition-all w-full justify-center"
            >
              <Plus className="h-4 w-4" />
              Agregar beneficio
            </button>
          </div>
        </div>

        {/* Estado */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Visibilidad</p>
          <div className="space-y-2">
            {([
              { name: 'isActive' as const, label: 'Plan activo', desc: 'Visible para los miembros' },
              { name: 'isFeatured' as const, label: 'Plan destacado', desc: 'Se muestra primero con badge dorado' },
              { name: 'storeEnabled' as const, label: 'Incluye tienda', desc: 'Miembros con este plan acceden a la tienda' },
            ] as const).map(({ name, label, desc }) => (
              <div key={name} className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
                </div>
                <Controller
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>
            ))}
          </div>
        </div>

        {serverError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
            {serverError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-black px-6 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear plan'}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onClose ? onClose() : router.push(`/gym/${gymSlug}/plans`)}
            className="rounded-xl border border-zinc-200 px-6 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* ── RIGHT: live preview ── */}
      {showPreview && <div className="lg:sticky lg:top-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Vista previa</p>
        <div className={cn(
          'rounded-2xl border-2 bg-white p-6 space-y-5 transition-all',
          isFeatured ? 'border-[#fffb00] shadow-lg' : 'border-zinc-200',
        )}>
          {/* Badge */}
          <div className="flex items-center justify-between">
            {isFeatured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fffb00] px-2.5 py-1 text-[10px] font-black text-black uppercase tracking-widest">
                <Star className="h-3 w-3" /> Destacado
              </span>
            ) : <span />}
            {!isActive && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Inactivo
              </span>
            )}
          </div>

          {/* Name + price */}
          <div>
            <p className="font-black text-xl text-zinc-900 leading-tight">
              {name || <span className="text-zinc-300">Nombre del plan</span>}
            </p>
            <p className="text-3xl font-black mt-2 tracking-tight">
              {price > 0
                ? <>{currencySymbol} {price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</>
                : <span className="text-[#1fad9d]">Gratis</span>
              }
            </p>
            {price > 0 && (
              <p className="text-xs text-zinc-400 mt-0.5">por mes</p>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
              <Zap className="h-3 w-3" />
              {durationPreset ? durationPreset.label : `${durationDays} días`}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
              {daysLabel}
            </span>
          </div>

          {/* Benefits */}
          {benefits.filter(b => b.value.trim()).length > 0 && (
            <ul className="space-y-2 pt-1 border-t border-zinc-100">
              {benefits.filter(b => b.value.trim()).map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-zinc-700">
                  <Check className="h-3.5 w-3.5 text-[#1fad9d] shrink-0" />
                  {b.value}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>}

    </form>
  )
}
