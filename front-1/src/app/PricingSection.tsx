'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DemoRequestModal } from './DemoRequestModal'

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

export function PricingSection({ plans, primaryColor, ctaUrl }: {
  plans: SubscriptionPlanPublic[]
  primaryColor: string
  ctaUrl: string
}) {
  if (plans.length === 0) return null

  const router = useRouter()
  const [yearly, setYearly] = useState(false)
  const [modalPlan, setModalPlan] = useState<SubscriptionPlanPublic | null>(null)

  function handleCtaClick(plan: SubscriptionPlanPublic) {
    if (plan.trialEnabled) {
      setModalPlan(plan)
    } else if (ctaUrl.startsWith('http')) {
      window.open(ctaUrl, '_blank', 'noopener,noreferrer')
    } else {
      router.push(ctaUrl)
    }
  }

  const hasYearly = plans.some(p => p.yearlyPrice != null && Number(p.yearlyPrice) > 0)
  const midIdx = Math.floor(plans.length / 2)
  const accentColor = primaryColor === '#fffb00' ? '#d97706' : primaryColor

  const maxAnnualSavingPct = (() => {
    let max = 0
    for (const p of plans) {
      if (!p.yearlyPrice || Number(p.yearlyPrice) === 0) continue
      const fp = (p.finalPrice != null && !isNaN(Number(p.finalPrice))) ? Number(p.finalPrice) : Number(p.price) * (1 - (p.discountPercent || 0) / 100)
      const yf = p.yearlyFinalPrice ?? (Number(p.yearlyPrice) * (1 - (p.discountPercent || 0) / 100))
      const ym = p.yearlyMonthlyEquivalent ?? (yf / 12)
      if (fp > 0 && ym > 0) {
        const pct = Math.round((1 - ym / fp) * 100)
        if (pct > max) max = pct
      }
    }
    return max
  })()

  return (
    <section id="planes" className="bg-white dark:bg-black py-28 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: accentColor }}>
            Precios
          </p>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-zinc-900 dark:text-white leading-tight">
            Un plan para cada etapa
          </h2>
          <p className="text-zinc-500 dark:text-white/40 leading-relaxed">
            Desde pequeños estudios hasta grandes cadenas. Sin sorpresas, sin cargos ocultos.
          </p>
        </div>

        {/* Monthly / Yearly toggle */}
        {hasYearly && (
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-white/10 p-1 bg-zinc-50 dark:bg-white/[0.03]">
              <button
                onClick={() => setYearly(false)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                  !yearly
                    ? 'bg-white dark:bg-white/10 shadow text-zinc-900 dark:text-white'
                    : 'text-zinc-500 dark:text-white/40 hover:text-zinc-700 dark:hover:text-white/60'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setYearly(true)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${
                  yearly
                    ? 'bg-white dark:bg-white/10 shadow text-zinc-900 dark:text-white'
                    : 'text-zinc-500 dark:text-white/40 hover:text-zinc-700 dark:hover:text-white/60'
                }`}
              >
                Anual
                {maxAnnualSavingPct > 0 && (
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                    -{maxAnnualSavingPct}%
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => {
            const featured = i === midIdx && plans.length > 1
            const hasActiveDiscount = plan.discountActive && plan.discountPercent > 0
            const finalPrice = (plan.finalPrice != null && !isNaN(Number(plan.finalPrice)))
              ? Number(plan.finalPrice)
              : Number(plan.price) * (1 - (plan.discountPercent || 0) / 100)
            const monthlyDisplay = hasActiveDiscount ? finalPrice : Number(plan.price)
            const hasYearlyForPlan = plan.yearlyPrice != null && Number(plan.yearlyPrice) > 0
            const yearlyFinalP = plan.yearlyFinalPrice ?? (hasYearlyForPlan ? Number(plan.yearlyPrice) * (1 - (plan.discountPercent || 0) / 100) : null)
            const yearlyMonthlyP = plan.yearlyMonthlyEquivalent ?? (yearlyFinalP != null ? yearlyFinalP / 12 : null)

            const displayPrice = yearly && hasYearlyForPlan && yearlyMonthlyP != null
              ? yearlyMonthlyP
              : monthlyDisplay

            const annualSavingPct = hasYearlyForPlan && yearlyMonthlyP != null && finalPrice > 0
              ? Math.round((1 - yearlyMonthlyP / finalPrice) * 100)
              : 0

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 space-y-6 transition-all duration-300 ${
                  featured
                    ? 'bg-zinc-900 text-white shadow-2xl scale-[1.02] border border-zinc-800 dark:bg-white/[0.06] dark:border-white/20'
                    : 'bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.12]'
                }`}
              >
                {featured && (
                  <div
                    className="absolute top-0 inset-x-6 h-0.5 rounded-full"
                    style={{ background: `linear-gradient(to right, transparent, ${primaryColor}, transparent)` }}
                  />
                )}
                {featured && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                    style={{ background: primaryColor, color: '#000' }}
                  >
                    Más popular
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <p className={`text-sm font-bold uppercase tracking-widest ${featured ? 'text-white/60' : 'text-zinc-500 dark:text-white/60'}`}>
                    {plan.label}
                  </p>

                  {Number(plan.price) === 0 ? (
                    <span className={`text-4xl font-black ${featured ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>Gratis</span>
                  ) : (
                    <div className="space-y-1">
                      {/* Strikethrough original when monthly discount active */}
                      {!yearly && hasActiveDiscount && (
                        <div className="flex items-center gap-2">
                          <span className={`text-sm line-through ${featured ? 'text-white/30' : 'text-zinc-400 dark:text-white/30'}`}>
                            {plan.currency} {Number(plan.price).toLocaleString('es-AR')}
                          </span>
                          <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                            {plan.discountPercent}% OFF
                          </span>
                        </div>
                      )}

                      {yearly && hasYearlyForPlan && yearlyFinalP != null ? (
                        <>
                          <div className="flex items-end gap-1">
                            <span className={`text-sm mb-2 ${featured ? 'text-white/40' : 'text-zinc-400 dark:text-white/40'}`}>{plan.currency}</span>
                            <span className={`text-4xl font-black ${featured ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
                              {Number(yearlyFinalP).toLocaleString('es-AR')}
                            </span>
                            <span className={`text-sm mb-2 ${featured ? 'text-white/40' : 'text-zinc-400 dark:text-white/40'}`}>/año</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {yearlyMonthlyP != null && (
                              <p className={`text-xs ${featured ? 'text-white/30' : 'text-zinc-400 dark:text-white/30'}`}>
                                = {plan.currency} {Number(yearlyMonthlyP).toLocaleString('es-AR', { maximumFractionDigits: 2 })}/mes
                              </p>
                            )}
                            {annualSavingPct > 0 && (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">
                                -{annualSavingPct}% vs mensual
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-end gap-1">
                          <span className={`text-sm mb-2 ${featured ? 'text-white/40' : 'text-zinc-400 dark:text-white/40'}`}>{plan.currency}</span>
                          <span className={`text-4xl font-black ${featured ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
                            {Number(displayPrice).toLocaleString('es-AR')}
                          </span>
                          <span className={`text-sm mb-2 ${featured ? 'text-white/40' : 'text-zinc-400 dark:text-white/40'}`}>/mes</span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className={`text-xs rounded-full px-2.5 py-1 w-fit ${featured ? 'text-white/30 border border-white/10' : 'text-zinc-400 dark:text-white/30 border border-zinc-200 dark:border-white/[0.06]'}`}>
                    {plan.maxMembers == null ? '∞ Miembros' : `Hasta ${plan.maxMembers} miembros`}
                  </p>
                </div>

                {plan.storeEnabled && (
                  <p className="text-xs font-bold text-[#1fad9d] bg-[#1fad9d]/10 border border-[#1fad9d]/20 rounded-full px-3 py-1 w-fit">
                    🏪 Tienda incluida
                  </p>
                )}

                <div className={`border-t ${featured ? 'border-white/10' : 'border-zinc-200 dark:border-white/[0.06]'}`} />

                <ul className="space-y-2.5">
                  {(plan.features as string[]).map((f, fi) => (
                    <li key={fi} className={`flex items-start gap-2.5 text-sm ${
                      isBenefit(f)
                        ? `font-semibold ${featured ? 'text-white' : 'text-zinc-900 dark:text-white'}`
                        : featured ? 'text-white/50' : 'text-zinc-500 dark:text-white/50'
                    }`}>
                      {isBenefit(f)
                        ? <Star className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" fill="currentColor" />
                        : <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      }
                      {featureText(f)}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCtaClick(plan)}
                  className={featured
                    ? 'block w-full text-center rounded-xl py-3 text-sm font-bold transition-all hover:opacity-90 active:scale-95'
                    : 'block w-full text-center rounded-xl py-3 text-sm font-bold transition-all bg-zinc-200 dark:bg-white/[0.06] text-zinc-700 dark:text-white hover:bg-zinc-300 dark:hover:bg-white/[0.1] border border-zinc-300 dark:border-white/10'
                  }
                  style={featured ? { background: primaryColor, color: '#000' } : undefined}
                >
                  {plan.trialEnabled
                    ? 'Probar 1 mes gratis'
                    : Number(plan.price) === 0 ? 'Comenzar gratis' : 'Comenzar ahora'
                  }
                </button>
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-zinc-400 dark:text-white/20">Sin tarjeta de crédito requerida · Cancela cuando quieras</p>
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
