'use client'

import { useState } from 'react'
import { Check, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DemoRequestModal } from './DemoRequestModal'
import s from './_landing/landing.module.css'

export interface SubscriptionPlanPublic {
  id: string
  key: string
  label: string
  price: number
  currency: string
  maxMembers: number | null
  storeEnabled: boolean
  demoEnabled: boolean
  trialEnabled: boolean
  features: string[]
  isActive: boolean
  sortOrder: number
  discountPercent: number
  discountActive: boolean
  finalPrice: number
  discountSaving: number
  yearlyPrice: number | null
  yearlyFinalPrice: number | null
  yearlySaving: number | null
  yearlyMonthlyEquivalent: number | null
}

function isBenefit(f: string) { return f.startsWith('★') }
function featureText(f: string) { return f.replace(/^★\s*/, '') }
const money = (n: number, max = 0) => n.toLocaleString('es-AR', { maximumFractionDigits: max })

function prices(p: SubscriptionPlanPublic) {
  const off = (p.discountPercent || 0) / 100
  const finalPrice = p.finalPrice != null && !isNaN(Number(p.finalPrice)) ? Number(p.finalPrice) : Number(p.price) * (1 - off)
  const hasDiscount = p.discountActive && p.discountPercent > 0
  const hasYearly = p.yearlyPrice != null && Number(p.yearlyPrice) > 0
  const yearlyFinal = p.yearlyFinalPrice ?? (hasYearly ? Number(p.yearlyPrice) * (1 - off) : null)
  const yearlyMonthly = p.yearlyMonthlyEquivalent ?? (yearlyFinal != null ? yearlyFinal / 12 : null)
  const yearlySavingPct = hasYearly && yearlyMonthly != null && finalPrice > 0 ? Math.round((1 - yearlyMonthly / finalPrice) * 100) : 0
  return { finalPrice, hasDiscount, hasYearly, yearlyFinal, yearlyMonthly, yearlySavingPct, monthly: hasDiscount ? finalPrice : Number(p.price) }
}

export function PricingSection({ plans, primaryColor, ctaUrl }: {
  plans: SubscriptionPlanPublic[]
  primaryColor: string
  ctaUrl: string
}) {
  const router = useRouter()
  const [yearly, setYearly] = useState(false)
  const [modalPlan, setModalPlan] = useState<SubscriptionPlanPublic | null>(null)

  if (plans.length === 0) return null

  function handleCtaClick(plan: SubscriptionPlanPublic) {
    if (plan.trialEnabled) {
      setModalPlan(plan)
    } else if (ctaUrl.startsWith('http')) {
      window.open(ctaUrl, '_blank', 'noopener,noreferrer')
    } else {
      router.push(ctaUrl)
    }
  }

  const hasYearly = plans.some(p => prices(p).hasYearly)
  const maxSavingPct = Math.max(0, ...plans.map(p => prices(p).yearlySavingPct))
  const midIdx = Math.floor(plans.length / 2)

  return (
    <section id="precios" className="border-y border-[#1c1c1e] bg-[#0f0f10] px-6 py-[120px]">
      <div className="mx-auto max-w-[1240px]">
        <div className={`${s.reveal} flex flex-wrap items-end justify-between gap-6`}>
          <h2 className={`${s.display} m-0 text-[clamp(40px,5vw,72px)]`}>Precios <span className={s.acc}>claros.</span></h2>
          {hasYearly && (
            <div role="group" aria-label="Facturación" className="flex gap-1 rounded-xl bg-[#1c1c1e] p-1">
              <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)} className={`${s.seg} ${!yearly ? s.segOn : ''}`}>
                Mensual
              </button>
              <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)} className={`${s.seg} ${yearly ? s.segOn : ''}`}>
                Anual
                {maxSavingPct > 0 && <span className={`${s.mono} text-xs`}>-{maxSavingPct}%</span>}
              </button>
            </div>
          )}
        </div>

        <div className="mt-14 flex flex-wrap items-stretch gap-4">
          {plans.map((plan, i) => {
            const featured = i === midIdx && plans.length > 1
            const pr = prices(plan)
            const showYearly = yearly && pr.hasYearly && pr.yearlyFinal != null
            return (
              <div key={plan.id} className={`${s.reveal} flex min-w-0 flex-[1_1_320px]`}>
                <article
                  className={`${s.cardHover} flex w-full flex-col gap-[22px] rounded-3xl border p-8 ${
                    featured ? 'border-(--acc) bg-(--acc) text-[#0b0b0c]' : 'border-[#2a2a2c] bg-[#141416] text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="m-0 text-[26px] font-black [font-stretch:115%]">{plan.label}</h3>
                    {featured && <span className={`${s.acc} rounded-full bg-[#0b0b0c] px-2.5 py-1.5 text-xs font-extrabold`}>MÁS ELEGIDO</span>}
                  </div>

                  <div>
                    {Number(plan.price) === 0 ? (
                      <span className={`${s.mono} text-[34px] font-bold`}>Gratis</span>
                    ) : showYearly ? (
                      <>
                        <span key="y" className={s.pop}>
                          <span className="text-[15px] opacity-70">{plan.currency} </span>
                          <span className={`${s.mono} text-[34px] font-bold`}>{money(Number(pr.yearlyFinal))}</span>
                          <span className="text-[15px] opacity-70"> / año</span>
                        </span>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm opacity-75">
                          {pr.yearlyMonthly != null && <span>= {plan.currency} {money(pr.yearlyMonthly, 2)} / mes</span>}
                          {pr.yearlySavingPct > 0 && <span className={`${s.mono} font-bold`}>-{pr.yearlySavingPct}% vs mensual</span>}
                        </div>
                      </>
                    ) : (
                      <>
                        {pr.hasDiscount && (
                          <div className="mb-1 flex items-center gap-2 text-sm">
                            <span className="line-through opacity-60">{plan.currency} {money(Number(plan.price))}</span>
                            <span className={`${s.mono} font-bold`}>{plan.discountPercent}% OFF</span>
                          </div>
                        )}
                        <span key="m" className={s.pop}>
                          <span className="text-[15px] opacity-70">{plan.currency} </span>
                          <span className={`${s.mono} text-[34px] font-bold`}>{money(pr.monthly)}</span>
                          <span className="text-[15px] opacity-70"> / mes</span>
                        </span>
                      </>
                    )}
                    <div className="mt-1.5 text-sm opacity-75">
                      {plan.maxMembers == null ? 'Socios ilimitados' : `Hasta ${plan.maxMembers} socios`}
                      {plan.storeEnabled && ' · Tienda incluida'}
                    </div>
                  </div>

                  <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px]">
                    {plan.features.map((f, fi) => (
                      <li key={fi} className={`flex items-start gap-2.5 ${isBenefit(f) ? 'font-bold' : ''}`}>
                        {isBenefit(f)
                          ? <Star className="mt-px size-[18px] shrink-0" fill="currentColor" aria-hidden="true" />
                          : <Check className="mt-px size-[18px] shrink-0" strokeWidth={2.6} aria-hidden="true" />}
                        {featureText(f)}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => handleCtaClick(plan)}
                    className={`mt-auto flex min-h-[52px] items-center justify-center rounded-xl font-extrabold transition-opacity hover:opacity-90 ${
                      featured ? 'bg-[#0b0b0c] text-white' : 'bg-(--acc) text-[#0b0b0c]'
                    }`}
                  >
                    {plan.trialEnabled ? 'Probar 1 mes gratis' : `Empezar con ${plan.label}`}
                  </button>
                </article>
              </div>
            )
          })}
        </div>
        <p className={`${s.reveal} mt-6 text-sm text-[#a3a39d]`}>Sin tarjeta de crédito · Cancelás cuando quieras.</p>
      </div>

      {modalPlan && (
        <DemoRequestModal
          open={!!modalPlan}
          onClose={() => setModalPlan(null)}
          plan={modalPlan}
          primaryColor={primaryColor}
        />
      )}
    </section>
  )
}
