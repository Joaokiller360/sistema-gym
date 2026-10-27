'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, useFieldArray, useWatch, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowRight, Check, Loader2, Plus, X } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Plan } from '@/types'
import { createBlockHandlers, zodSafeField } from '@/lib/input-validation'
import { createPlanAction, deletePlanAction, updatePlanAction } from './actions'
import { accessLabel, durationLabel, money as moneyIn, peopleLabel, pricePerDay, trainableDays } from './planMath'
import { useLocale, useT } from '@/i18n/client'
import { plansMessages } from './messages'

type DrawerMessages = (typeof plansMessages)['es']['drawer']

const nameHandlers = createBlockHandlers('text')
const priceHandlers = createBlockHandlers('price')
const numberHandlers = createBlockHandlers('number')

const formSchema = (t: DrawerMessages) => z.object({
  name: z.string().min(1, t.nameRequired).max(100, t.nameMax).refine(
    zodSafeField('text'),
    t.safeText,
  ),
  price: z.number({ message: t.badPrice }).min(0).max(999, t.priceMax),
  currency: z.string().min(1),
  durationDays: z.number({ message: t.badDuration }).int().min(1, t.min1Day).max(365, t.max365Days),
  daysPerWeek: z.string().min(1),
  visitLimit: z.string().refine(
    v => v === 'unlimited' || /^[1-9]\d{0,2}$/.test(v) && Number(v) <= 365,
    t.visitRange,
  ),
  maxMembers: z.number().int().min(1).max(5),
  benefits: z.array(z.object({
    value: z.string().refine(
      v => v === '' || zodSafeField('text')(v),
      t.safeText,
    ),
  })),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  storeEnabled: z.boolean(),
})

type FormValues = z.infer<ReturnType<typeof formSchema>>

const CURRENCIES = ['USD', 'ARS', 'BRL', 'CLP', 'MXN', 'EUR']
const DURATION_PRESETS = [30, 60, 90, 180, 365]
const VISIT_PRESETS = [8, 12, 16, 20]
const WEEK_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', 'unlimited']
const PEOPLE_OPTIONS = [1, 2, 3, 4, 5]

// Labels live in plansMessages.drawer.steps (same order)
const STEPS: { fields: FieldPath<FormValues>[] }[] = [
  { fields: ['name', 'price', 'currency'] },
  { fields: ['durationDays', 'daysPerWeek', 'visitLimit', 'maxMembers'] },
  { fields: ['benefits'] },
]

const LABEL = 'text-xs font-bold uppercase tracking-[0.08em] text-adm-muted'
const INPUT = 'h-12 w-full rounded-xl border border-adm-line bg-adm-ground px-3.5 text-base font-bold text-adm-ink outline-none transition-colors placeholder:font-normal placeholder:text-adm-muted focus:border-adm-ink dark:focus:border-adm-brand disabled:opacity-50'

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs font-medium text-adm-bad-fg">{msg}</p>
}

function choice(on: boolean) {
  return on
    ? 'border-2 border-adm-ink dark:border-adm-brand bg-adm-subtle text-adm-ink'
    : 'border border-adm-line bg-transparent text-adm-ink hover:border-adm-muted'
}

interface Props {
  gymSlug: string
  plan: Plan | null
  members: number
  featured: Plan | null
}

export function PlanDrawer({ gymSlug, plan, members, featured }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEdit = !!plan
  const [isOpen, setIsOpen] = useState(true)
  const [step, setStep] = useState(0)
  const [reached, setReached] = useState(isEdit ? STEPS.length - 1 : 0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const t = useT(plansMessages).drawer
  const locale = useLocale()
  const money = (value: number, currency: string, decimals = 0) => moneyIn(value, currency, decimals, locale)
  const [schema] = useState(() => formSchema(t))
  const steps = STEPS.map((s, i) => ({ ...s, ...t.steps[i] }))

  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: plan
      ? {
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          durationDays: plan.durationDays,
          daysPerWeek: plan.daysPerWeek == null ? 'unlimited' : String(plan.daysPerWeek),
          visitLimit: plan.visitLimit == null ? 'unlimited' : String(plan.visitLimit),
          maxMembers: plan.maxMembers ?? 1,
          benefits: plan.benefits.map(value => ({ value })),
          isActive: plan.isActive,
          isFeatured: plan.isFeatured,
          storeEnabled: plan.storeEnabled,
        }
      : {
          name: '',
          price: 0,
          currency: 'USD',
          durationDays: 30,
          daysPerWeek: 'unlimited',
          visitLimit: 'unlimited',
          maxMembers: 1,
          benefits: [],
          isActive: true,
          isFeatured: false,
          storeEnabled: false,
        },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'benefits' })

  const values = useWatch({ control }) as FormValues
  const isVisitPlan = values.visitLimit !== 'unlimited'
  const shape = {
    price: Number.isFinite(values.price) ? values.price : 0,
    durationDays: values.durationDays || 1,
    daysPerWeek: values.daysPerWeek === 'unlimited' ? null : Number(values.daysPerWeek),
    visitLimit: isVisitPlan ? Number(values.visitLimit) || 1 : null,
  }
  const perDay = pricePerDay(shape)
  const compareTo = featured && featured.id !== plan?.id && featured.currency === values.currency ? featured : null
  const diffPct = compareTo ? Math.round((perDay / pricePerDay(compareTo) - 1) * 100) : null

  function close() {
    setIsOpen(false)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('new')
      params.delete('edit')
      const str = params.toString()
      router.push(str ? `?${str}` : '?')
    }, 150)
  }

  async function goTo(target: number) {
    if (target > step) {
      const ok = await trigger(STEPS[step].fields)
      if (!ok) return
    }
    setStep(target)
    setReached(r => Math.max(r, target))
  }

  function save(data: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const res = isEdit ? await updatePlanAction(gymSlug, plan.id, data) : await createPlanAction(gymSlug, data)
      if (res?.error) { setServerError(res.error); return }
      toast.success(isEdit ? t.updated : t.created)
      close()
    })
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Enter on an early step advances instead of saving
    if (step < STEPS.length - 1 && !isEdit) {
      e.preventDefault()
      void goTo(step + 1)
      return
    }
    void handleSubmit(save)(e)
  }

  function handleDelete() {
    if (!plan) return
    setConfirmDelete(false)
    startTransition(async () => {
      await deletePlanAction(gymSlug, plan.id)
      toast.success(t.deleted)
      close()
    })
  }

  const isLast = step === STEPS.length - 1

  return (
    <>
      <Sheet open={isOpen} onOpenChange={open => { if (!open) close() }}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="admin-surface w-full gap-0 border-adm-line bg-adm-surface p-0 text-adm-ink sm:max-w-[640px] data-[side=right]:w-full data-[side=right]:sm:max-w-[640px]"
        >
          <form onSubmit={onSubmit} className="flex h-full min-h-0 flex-col">
            <header className="flex flex-col gap-[18px] border-b border-adm-line px-5 pb-[18px] pt-[22px] sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="font-admin-mono text-xs text-adm-muted">
                    {isEdit ? t.editEyebrow(members) : t.newEyebrow}
                  </p>
                  <SheetTitle className="truncate text-[26px] font-black tracking-[-0.02em] text-adm-ink">
                    {values.name || (isEdit ? plan.name : t.untitled)}
                  </SheetTitle>
                  <SheetDescription className="sr-only">{t.a11yDesc}</SheetDescription>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t.close}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-adm-line text-adm-muted transition-colors hover:text-adm-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol aria-label={t.stepsLabel} className="grid grid-cols-3 gap-2">
                {steps.map((s, i) => {
                  const current = i === step
                  const done = i < step || (isEdit && i !== step)
                  const reachable = i <= reached
                  return (
                    <li key={s.label}>
                      <button
                        type="button"
                        disabled={!reachable}
                        aria-current={current ? 'step' : undefined}
                        onClick={() => goTo(i)}
                        className={`flex min-h-[52px] w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors disabled:opacity-50 ${
                          current ? 'border-adm-muted/60 bg-adm-subtle' : 'border-transparent hover:bg-adm-subtle'
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-admin-mono text-[13px] font-bold ${
                          current ? 'bg-adm-brand text-adm-night' : done ? 'bg-adm-line text-adm-ink' : 'border border-adm-line text-adm-muted'
                        }`}>
                          {done && !current ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-extrabold">{s.label}</span>
                          <span className="hidden truncate text-xs text-adm-muted sm:block">{s.hint}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-5 py-6 sm:px-7">
              {/* ── 1 · Básico ── */}
              {step === 0 && (
                <>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="plan-name" className={LABEL}>{t.name}</label>
                    <input
                      id="plan-name"
                      autoFocus
                      placeholder={t.namePlaceholder}
                      disabled={isPending}
                      {...register('name')}
                      {...nameHandlers}
                      className={INPUT}
                    />
                    <FieldError msg={errors.name?.message} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="plan-price" className={LABEL}>{t.price}</label>
                    <div className="flex gap-2">
                      <input
                        id="plan-price"
                        type="text"
                        inputMode="decimal"
                        maxLength={3}
                        disabled={isPending}
                        {...register('price', { setValueAs: v => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0 })}
                        {...priceHandlers}
                        className={`${INPUT} font-admin-mono`}
                      />
                      <label htmlFor="plan-currency" className="sr-only">{t.currency}</label>
                      <select
                        id="plan-currency"
                        disabled={isPending}
                        {...register('currency')}
                        className="h-12 w-28 shrink-0 rounded-xl border border-adm-line bg-adm-ground px-3 text-sm font-bold text-adm-ink"
                      >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <FieldError msg={errors.price?.message} />
                    <p className="text-[13px] text-adm-muted">{t.priceHint}</p>
                  </div>
                </>
              )}

              {/* ── 2 · Acceso ── */}
              {step === 1 && (
                <>
                  <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
                    <legend className={`${LABEL} mb-2.5 p-0`}>{t.planType}</legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {([
                        { visits: false, label: t.byTime, desc: t.byTimeDesc },
                        { visits: true, label: t.byVisits, desc: t.byVisitsDesc },
                      ] as const).map(o => (
                        <button
                          key={o.label}
                          type="button"
                          aria-pressed={isVisitPlan === o.visits}
                          onClick={() => {
                            setValue('visitLimit', o.visits ? (isVisitPlan ? values.visitLimit : '12') : 'unlimited', { shouldValidate: true })
                            if (o.visits) setValue('daysPerWeek', 'unlimited')
                          }}
                          className={`flex flex-col gap-1 rounded-[14px] p-4 text-left transition-colors ${choice(isVisitPlan === o.visits)}`}
                        >
                          <span className="text-[15px] font-extrabold">{o.label}</span>
                          <span className="text-[13px] text-adm-muted">{o.desc}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-baseline justify-between">
                      <p className={LABEL}>{t.people}</p>
                      {values.maxMembers > 1 && (
                        <p className="font-admin-mono text-[13px]">{t.each(money(shape.price / values.maxMembers, values.currency))}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {PEOPLE_OPTIONS.map(n => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={values.maxMembers === n}
                          onClick={() => setValue('maxMembers', n, { shouldValidate: true })}
                          className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl transition-colors ${choice(values.maxMembers === n)}`}
                        >
                          <span className="font-admin-mono text-base font-bold">{n}</span>
                          <span className="text-[11px] text-adm-muted">{n === 1 ? t.individual : t.peopleUnit}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[13px] text-adm-muted">
                      {values.maxMembers > 1
                        ? t.sharedHint(values.maxMembers)
                        : t.singleHint}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <p className={LABEL}>{isVisitPlan ? t.maxValidity : t.duration}</p>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                      {DURATION_PRESETS.map(d => (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={values.durationDays === d}
                          onClick={() => setValue('durationDays', d, { shouldValidate: true })}
                          className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${choice(values.durationDays === d)}`}
                        >
                          <span className="text-[15px] font-extrabold">{durationLabel(d, locale)}</span>
                          <span className="font-admin-mono text-[11px] text-adm-muted">{d} d</span>
                        </button>
                      ))}
                    </div>
                    <label className="inline-flex items-center gap-2 text-[13px] text-adm-muted">
                      {t.other}
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={3}
                        placeholder={t.daysPlaceholder}
                        value={DURATION_PRESETS.includes(values.durationDays) ? '' : values.durationDays || ''}
                        onChange={e => setValue('durationDays', parseInt(e.target.value, 10) || 0, { shouldValidate: true })}
                        {...numberHandlers}
                        className="h-10 w-[72px] rounded-[10px] border border-adm-line bg-adm-ground px-2.5 font-admin-mono text-sm font-bold text-adm-ink outline-none focus:border-adm-ink dark:focus:border-adm-brand"
                      />
                    </label>
                    <FieldError msg={errors.durationDays?.message} />
                  </div>

                  {isVisitPlan ? (
                    <div className="flex flex-col gap-2.5">
                      <p className={LABEL}>{t.includedDays}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {VISIT_PRESETS.map(n => (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={values.visitLimit === String(n)}
                            onClick={() => setValue('visitLimit', String(n), { shouldValidate: true })}
                            className={`h-12 min-w-[72px] rounded-xl px-3 font-admin-mono text-base font-bold transition-colors ${choice(values.visitLimit === String(n))}`}
                          >
                            {n}
                          </button>
                        ))}
                        <label className="sr-only" htmlFor="plan-visits">{t.otherDays}</label>
                        <input
                          id="plan-visits"
                          type="text"
                          inputMode="numeric"
                          maxLength={3}
                          {...register('visitLimit')}
                          {...numberHandlers}
                          className="h-12 w-[88px] rounded-xl border border-adm-line bg-adm-ground px-3 font-admin-mono text-base font-bold text-adm-ink outline-none focus:border-adm-ink dark:focus:border-adm-brand"
                        />
                      </div>
                      <FieldError msg={errors.visitLimit?.message} />
                      <p className="text-[13px] text-adm-muted">
                        {t.lastDayHint}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-baseline justify-between">
                        <p className={LABEL}>{t.daysPerWeek}</p>
                        <p className="font-admin-mono text-[13px]">
                          {values.daysPerWeek === 'unlimited' ? t.noLimit : t.ofSeven(values.daysPerWeek)}
                        </p>
                      </div>
                      <div className="grid grid-cols-8 gap-1.5">
                        {WEEK_OPTIONS.map(w => {
                          const on = values.daysPerWeek === w
                          return (
                            <button
                              key={w}
                              type="button"
                              aria-pressed={on}
                              aria-label={w === 'unlimited' ? t.noWeeklyLimit : t.perWeekAria(w)}
                              onClick={() => setValue('daysPerWeek', w, { shouldValidate: true })}
                              className={`h-12 rounded-xl font-admin-mono text-base font-bold transition-colors ${
                                on ? 'bg-adm-brand text-adm-night' : 'border border-adm-line text-adm-muted hover:text-adm-ink'
                              }`}
                            >
                              {w === 'unlimited' ? '∞' : w}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── 3 · Beneficios y visibilidad ── */}
              {step === 2 && (
                <>
                  <div className="flex flex-col gap-2.5">
                    <p className={LABEL}>{t.benefits}</p>
                    <ul className="flex flex-col gap-1.5">
                      {fields.map((field, index) => (
                        <li key={field.id} className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <label htmlFor={`benefit-${index}`} className="sr-only">{t.benefit(index + 1)}</label>
                            <input
                              id={`benefit-${index}`}
                              placeholder={t.benefit(index + 1)}
                              disabled={isPending}
                              {...register(`benefits.${index}.value`)}
                              {...nameHandlers}
                              className="h-11 flex-1 rounded-[10px] border border-adm-line bg-adm-ground px-3 text-sm text-adm-ink outline-none placeholder:text-adm-muted focus:border-adm-ink dark:focus:border-adm-brand"
                            />
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              aria-label={t.removeBenefit(index + 1)}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-adm-line text-adm-muted transition-colors hover:text-adm-bad-fg"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <FieldError msg={errors.benefits?.[index]?.value?.message} />
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => append({ value: '' })}
                      className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-adm-line text-sm font-bold text-adm-muted transition-colors hover:border-adm-ink dark:hover:border-adm-brand hover:text-adm-ink"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      {t.addBenefit}
                    </button>
                  </div>

                  <div className="flex flex-col rounded-2xl border border-adm-line bg-adm-ground px-4 py-1.5">
                    {([
                      { name: 'isActive', ...t.toggles.isActive },
                      { name: 'isFeatured', ...t.toggles.isFeatured },
                      { name: 'storeEnabled', ...t.toggles.storeEnabled },
                    ] as const).map(({ name, label, desc }, i) => {
                      const on = values[name]
                      return (
                        <div key={name} className={`flex items-center gap-3 py-3 ${i ? 'border-t border-adm-line' : ''}`}>
                          <span className="flex flex-1 flex-col gap-0.5">
                            <span className="text-sm font-bold">{label}</span>
                            <span className="text-xs text-adm-muted">{desc}</span>
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label={label}
                            onClick={() => setValue(name, !on)}
                            className={`flex h-7 w-12 shrink-0 rounded-full p-[3px] transition-colors ${on ? 'justify-end bg-adm-brand' : 'justify-start bg-adm-line'}`}
                          >
                            <span className="h-[22px] w-[22px] rounded-full bg-adm-night" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {serverError && (
                <p role="alert" className="rounded-xl border border-adm-bad-line bg-adm-bad-bg px-4 py-3 text-sm font-medium text-adm-bad-fg">
                  {serverError}
                </p>
              )}

              {/* Summary */}
              <div className="mt-auto flex items-center gap-4 rounded-2xl border border-adm-line bg-adm-ground px-[18px] py-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className={LABEL}>{t.summary}</p>
                  <p className="truncate text-base font-extrabold">
                    {money(shape.price, values.currency)} · {durationLabel(shape.durationDays, locale)} · {accessLabel(shape, locale)}
                    {values.maxMembers > 1 && ` · ${peopleLabel(values.maxMembers, locale)}`}
                  </p>
                  <p className="font-admin-mono text-xs text-adm-muted">
                    {t.possibleDays(trainableDays(shape), money(perDay, values.currency, 2))}
                  </p>
                </div>
                {compareTo && diffPct !== null && (
                  <div className="flex shrink-0 flex-col gap-0.5 text-right">
                    <span className="max-w-[140px] truncate text-xs text-adm-muted">{t.vs(compareTo.name)}</span>
                    <span className="font-admin-mono text-[15px] font-bold text-adm-ink dark:text-adm-brand">
                      {t.perDayDiff(`${diffPct > 0 ? '+' : ''}${diffPct}`)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <footer className="flex items-center gap-2.5 border-t border-adm-line px-5 py-4 sm:px-7">
              {isEdit && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                  className="h-11 rounded-xl px-3 text-sm font-bold text-adm-bad-fg transition-colors hover:bg-adm-bad-bg disabled:opacity-50"
                >
                  {t.delete}
                </button>
              )}
              <span className="flex-1" />
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => goTo(step - 1)}
                  disabled={isPending}
                  className="h-11 rounded-xl border border-adm-line px-[18px] text-sm font-bold transition-colors hover:bg-adm-chip disabled:opacity-50"
                >
                  {t.back}
                </button>
              )}
              {isEdit && !isLast && (
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-11 rounded-xl border border-adm-ink px-[18px] text-sm font-bold transition-colors hover:bg-adm-chip disabled:opacity-50"
                >
                  {t.save}
                </button>
              )}
              {isLast ? (
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-adm-brand px-[22px] text-sm font-black text-adm-night transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {isPending ? t.saving : isEdit ? t.saveChanges : t.create}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => goTo(step + 1)}
                  disabled={isPending}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-adm-brand px-[22px] text-sm font-black text-adm-night transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <span className="hidden sm:inline">{t.nextStep(steps[step + 1].label)}</span>
                  <span className="sm:hidden">{t.next}</span>
                  <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                </button>
              )}
            </footer>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {members > 0
                ? t.deleteWithMembers(plan?.name ?? '', members)
                : t.deleteConfirm(plan?.name ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-[#ff0000] text-white hover:bg-red-700">
              {t.deleteTitle}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
