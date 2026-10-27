'use client'

import { planAccessSummary } from '@/lib/plans'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft, CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { changeMemberPlanAction, ProratedResult } from './actions'
import type { Plan } from '@/types'
import { useIntlLocale, useLocale, useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'
import { membersMessages } from '../messages'

const METHODS = ['CASH', 'CARD', 'TRANSFER', 'OTHER'] as const

function fmtMoney(n: number, currency: string, intl: string) {
  return `${currency} ${n.toLocaleString(intl, { minimumFractionDigits: 2 })}`
}

function ProratedBreakdown({ p, currency }: { p: ProratedResult; currency: string }) {
  const t = useT(membersMessages).change
  const intl = useIntlLocale()
  const money = (n: number) => fmtMoney(n, currency, intl)
  return (
    <div className="rounded-xl bg-[#1fad9d]/8 border border-[#1fad9d]/20 p-4 space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-[#0e7a70]">{t.breakdown}</p>
      <div className="space-y-1">
        {[
          [t.daysConsumed, t.days(p.daysConsumed)],
          [t.daysRemaining, t.days(p.daysRemaining)],
          [t.dailyRate, money(p.dailyRate)],
          [t.credit, money(p.creditAmount/100)],
          [t.newPrice, money(p.newPlanPrice/100)],
          [t.creditApplied, `- ${money(p.creditApplied/100)}`],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-zinc-500">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-[#1fad9d]/20 pt-2 flex justify-between font-black text-base">
        <span>{t.totalCharged}</span>
        <span className="text-[#0e7a70]">{money(p.amountDue/100)}</span>
      </div>
    </div>
  )
}

export function ChangePlanForm({
  memberId,
  gymSlug,
  membershipId,
  currentPlanId,
  plans,
}: {
  memberId: string
  gymSlug: string
  membershipId: string
  currentPlanId?: string
  plans: Plan[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'>('CASH')
  const [notes, setNotes] = useState('')
  const [proration, setProration] = useState<ProratedResult | null>(null)
  const t = useT(membersMessages).change
  const tc = useT(commonMessages)
  const locale = useLocale()
  const intl = useIntlLocale()

  const availablePlans = plans.filter(p => p.isActive && p.id !== currentPlanId)
  const selectedPlan = availablePlans.find(p => p.id === selectedPlanId)

  function reset() {
    setOpen(false)
    setSelectedPlanId('')
    setNotes('')
    setProration(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlanId) return
    startTransition(async () => {
      const res = await changeMemberPlanAction(gymSlug, memberId, membershipId, {
        planId: selectedPlanId,
        method,
        notes: notes.trim() || undefined,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        setProration(res.proration ?? null)
        toast.success(t.changed)
        router.refresh()
      }
    })
  }

  if (proration) {
    return (
      <div className="space-y-3">
        <ProratedBreakdown p={proration} currency={selectedPlan?.currency ?? 'USD'} />
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-black transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-[#1fad9d]" /> {t.done}
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-500 hover:border-black hover:text-black transition-all w-full justify-center"
      >
        <ArrowRightLeft className="h-4 w-4" />
        {t.title}
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-zinc-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">{t.title}</p>
        <button type="button" onClick={reset} className="text-zinc-400 hover:text-zinc-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {availablePlans.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-4">{t.noOtherPlans}</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.newPlan}</label>
            <div className="space-y-2">
              {availablePlans.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    selectedPlanId === p.id ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-zinc-400">
                      {planAccessSummary(p, 1, locale)}
                    </p>
                  </div>
                  <span className="text-sm font-bold shrink-0 ml-3">
                    {p.currency} {Number(p.price).toLocaleString(intl)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.paymentMethod}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {METHODS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  disabled={isPending}
                  className={`rounded-xl py-2 text-xs font-semibold border-2 transition-all ${
                    method === m ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  }`}
                >
                  {tc.methods[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.notes}</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t.notesPlaceholder}
              disabled={isPending}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#fffb00] transition-all disabled:opacity-50"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || !selectedPlanId}
              className="flex-1 rounded-xl bg-black py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
            >
              {isPending ? t.changing : t.confirm}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
            >
              {tc.cancel}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
