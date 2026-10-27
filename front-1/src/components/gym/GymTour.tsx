'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { completeTourAction } from '@/lib/tour'
import { canAccessSection, isStaffRole } from '@/lib/gym-access'
import { useT } from '@/i18n/client'
import { tourMessages } from './tourMessages'

/** Dispatch on window to (re)start the tour, e.g. from the sidebar button. */
export const TOUR_START_EVENT = 'gym-tour:start'

interface TourStep {
  id: string
  /** Matches a `data-tour` attribute; steps without one show a centered card */
  target?: string
  /** Section opened behind the overlay, relative to /gym/[slug] */
  path?: string
  storeOnly?: boolean
  /** Only for front-desk roles (owners already reach it from the dashboard) */
  staffOnly?: boolean
  /** Owner-only intro/outro; front-desk roles get the `<id>Staff` variant */
  ownerOnly?: boolean
}

// Texts live in tourMessages, keyed by id.
const STEPS: TourStep[] = [
  { id: 'welcome', path: 'dashboard', ownerOnly: true },
  { id: 'welcomeStaff', path: 'attendance', staffOnly: true },
  { id: 'charge', target: 'nav-payments/new', path: 'payments/new', staffOnly: true },
  { id: 'dashboard', target: 'nav-dashboard', path: 'dashboard' },
  { id: 'settings', target: 'nav-settings', path: 'settings' },
  { id: 'plans', target: 'nav-plans', path: 'plans' },
  { id: 'members', target: 'nav-members', path: 'members' },
  { id: 'memberships', target: 'nav-memberships', path: 'memberships' },
  { id: 'scan', target: 'nav-attendance/scan', path: 'attendance/scan' },
  { id: 'attendance', target: 'nav-attendance', path: 'attendance' },
  { id: 'store', target: 'nav-store', path: 'store', storeOnly: true },
  { id: 'trainers', target: 'nav-trainers', path: 'trainers' },
  { id: 'classes', target: 'nav-classes', path: 'classes' },
  { id: 'inventory', target: 'nav-inventory', path: 'inventory' },
  { id: 'reports', target: 'nav-reports', path: 'reports' },
  { id: 'marketing', target: 'nav-marketing', path: 'marketing' },
  { id: 'communications', target: 'nav-communications', path: 'communications' },
  { id: 'support', target: 'nav-support', path: 'support' },
  { id: 'search', target: 'search' },
  { id: 'tourButton', target: 'tour-button' },
  { id: 'done', path: 'settings', ownerOnly: true },
  { id: 'doneStaff', path: 'attendance', staffOnly: true },
]

const CARD_W = 360
const GAP = 18
const PAD = 6

function findTarget(name: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(name)}"]`)
  // The sidebar is rendered twice (desktop + mobile drawer); pick the visible one.
  return Array.from(nodes).find(n => n.getClientRects().length > 0) ?? null
}

interface Props {
  gymSlug: string
  autoStart: boolean
  storeEnabled?: boolean
  userRole?: string
}

export function GymTour({ gymSlug, autoStart, storeEnabled, userRole }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useT(tourMessages)
  const staff = isStaffRole(userRole)
  // Only the sections this role can open (same rules as the sidebar and the proxy)
  const steps = STEPS
    .filter(s => (!s.storeOnly || storeEnabled) && (staff ? !s.ownerOnly : !s.staffOnly) && (!s.path || canAccessSection(userRole, s.path)))
    .map(s => ({ ...s, ...t.steps[s.id] }))

  const [open, setOpen] = useState(autoStart)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardH, setCardH] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  const step = steps[Math.min(index, steps.length - 1)]
  const last = index === steps.length - 1

  const goTo = useCallback((i: number) => {
    const s = steps[i]
    if (!s) return
    setIndex(i)
    if (s.path) {
      const href = `/gym/${gymSlug}/${s.path}`
      if (pathname !== href) router.push(href)
    }
  }, [steps, gymSlug, pathname, router])

  const close = useCallback(() => {
    setOpen(false)
    void completeTourAction()
  }, [])

  useEffect(() => {
    const start = () => { setOpen(true); goTo(0) }
    window.addEventListener(TOUR_START_EVENT, start)
    return () => window.removeEventListener(TOUR_START_EVENT, start)
  }, [goTo])

  // Track the highlighted element; it can move on resize or while the sidebar scrolls.
  useEffect(() => {
    if (!open) return
    let frame = 0
    const measure = () => {
      const el = step.target ? findTarget(step.target) : null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    const el = step.target ? findTarget(step.target) : null
    el?.scrollIntoView({ block: 'nearest' })
    frame = requestAnimationFrame(measure)
    const onChange = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
    }
  }, [open, step])

  useEffect(() => {
    const card = cardRef.current
    if (!open || !card) return
    const ro = new ResizeObserver(() => setCardH(card.offsetHeight))
    ro.observe(card)
    return () => ro.disconnect()
  }, [open])

  useEffect(() => {
    if (open) nextRef.current?.focus({ preventScroll: true })
  }, [open, index])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') { e.preventDefault(); if (!last) goTo(index + 1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (index > 0) goTo(index - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, last, goTo, close])

  if (!open) return null

  // Card beside the target when there is room, otherwise below it; centered without a target.
  let cardStyle: React.CSSProperties | undefined
  if (rect) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right + GAP + CARD_W + 16 <= vw) {
      const top = rect.top + rect.height / 2 - cardH / 2
      cardStyle = { left: rect.right + GAP, top: Math.max(16, Math.min(top, vh - cardH - 16)) }
    } else {
      const left = Math.max(16, Math.min(rect.left, vw - CARD_W - 16))
      const below = rect.bottom + GAP
      cardStyle = { left, top: below + cardH + 16 <= vh ? below : Math.max(16, rect.top - GAP - cardH) }
    }
  }

  return (
    <div className="fixed inset-0 z-[70] font-admin" role="presentation">
      {/* Click shield: the panel stays visible but can't be used mid-tour */}
      <div className={`absolute inset-0 ${rect ? '' : 'bg-black/65 backdrop-blur-[2px]'}`} />

      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-adm-brand transition-all duration-300 ease-out"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.65)',
          }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gym-tour-title"
        aria-describedby="gym-tour-body"
        style={cardStyle}
        className={`absolute w-[calc(100%-32px)] max-w-[360px] rounded-[18px] border border-[#2a2a2c] bg-adm-night p-5 text-white shadow-2xl transition-[left,top] duration-300 ease-out ${
          rect ? '' : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-admin-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-adm-brand">
            {step.section}
          </p>
          <button
            type="button"
            onClick={close}
            aria-label={t.close}
            className="-mr-1.5 flex size-8 items-center justify-center rounded-lg text-[#a3a39d] hover:bg-[#1c1c1e] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2 id="gym-tour-title" className="mt-2 text-[22px] font-black leading-tight tracking-[-0.01em]">{step.title}</h2>
        <p id="gym-tour-body" className="mt-2 text-sm leading-relaxed text-[#c9c9c3]">{step.body}</p>
        {step.tip && (
          <p className="mt-3 rounded-[10px] border border-[#2a2a2c] bg-[#141416] px-3 py-2 text-[13px] text-[#e7e7e2]">
            {step.tip}
          </p>
        )}

        <div className="mt-5 flex items-center gap-1" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.title} className={`h-1 flex-1 rounded-full ${i <= index ? 'bg-adm-brand' : 'bg-[#2a2a2c]'}`} />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="font-admin-mono text-xs text-[#85857f]">{index + 1} / {steps.length}</span>
          <div className="ml-auto flex items-center gap-2">
            {index === 0 ? (
              <button
                type="button"
                onClick={close}
                className="h-10 rounded-[10px] px-3 text-sm font-bold text-[#a3a39d] hover:text-white"
              >
                {t.skip}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                aria-label={t.prev}
                className="flex size-10 items-center justify-center rounded-[10px] border border-[#2a2a2c] text-[#e7e7e2] hover:border-[#3a3a3d]"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={() => (last ? close() : goTo(index + 1))}
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-adm-brand px-4 text-sm font-black text-adm-night hover:opacity-90"
            >
              {index === 0 ? t.start : last ? (staff ? t.finishStaff : t.finish) : t.next}
              {!last && <ArrowRight className="size-4" strokeWidth={2.6} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
