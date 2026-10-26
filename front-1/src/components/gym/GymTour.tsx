'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { completeTourAction } from '@/lib/tour'

/** Dispatch on window to (re)start the tour, e.g. from the sidebar button. */
export const TOUR_START_EVENT = 'gym-tour:start'

interface TourStep {
  /** Matches a `data-tour` attribute; steps without one show a centered card */
  target?: string
  /** Section opened behind the overlay, relative to /gym/[slug] */
  path?: string
  section: string
  title: string
  body: string
  tip?: string
  storeOnly?: boolean
}

const STEPS: TourStep[] = [
  {
    path: 'dashboard',
    section: 'Bienvenida',
    title: 'Te damos la bienvenida a tu panel',
    body: 'En unos minutos te mostramos dónde está cada parte del sistema y para qué sirve. Puedes salir cuando quieras y repetir el recorrido desde el menú.',
  },
  {
    target: 'nav-dashboard', path: 'dashboard', section: 'Principal',
    title: 'Dashboard',
    body: 'El resumen del día: ingresos, socios activos, asistencias y membresías que están por vencer.',
    tip: 'Desde aquí también puedes registrar una entrada rápida.',
  },
  {
    target: 'nav-settings', path: 'settings', section: 'Primer paso',
    title: 'Configura tu gimnasio',
    body: 'Sube tu logo y define la moneda, el país, la zona horaria y el horario de apertura. Desde la pestaña "Equipo y acceso" puedes invitar a otros administradores.',
    tip: 'Te recomendamos empezar por aquí.',
  },
  {
    target: 'nav-plans', path: 'plans', section: 'Principal',
    title: 'Planes',
    body: 'Crea tus tarifas: precio, duración, días y horarios de acceso, beneficios y planes compartidos para varias personas.',
    tip: 'Necesitas al menos un plan para inscribir socios.',
  },
  {
    target: 'nav-members', path: 'members', section: 'Principal',
    title: 'Miembros',
    body: 'Registra a tus socios y abre su ficha para ver los pagos, las asistencias y el estado de su plan, o para asignarle uno nuevo.',
  },
  {
    target: 'nav-memberships', path: 'memberships', section: 'Principal',
    title: 'Membresías',
    body: 'Todas las suscripciones activas, vencidas y congeladas. Desde aquí controlas las renovaciones y los vencimientos.',
  },
  {
    target: 'nav-attendance/scan', path: 'attendance/scan', section: 'Operaciones',
    title: 'Escanear QR',
    body: 'En recepción, escanea el código QR del socio para registrar su entrada en un segundo.',
  },
  {
    target: 'nav-attendance', path: 'attendance', section: 'Operaciones',
    title: 'Asistencia',
    body: 'El registro de entradas por día: busca a un socio, marca su llegada y exporta el historial.',
  },
  {
    target: 'nav-store', path: 'store', section: 'Operaciones', storeOnly: true,
    title: 'Tienda',
    body: 'Vende productos en el mostrador y lleva el control de las ventas.',
  },
  {
    target: 'nav-trainers', path: 'trainers', section: 'Operaciones',
    title: 'Entrenadores',
    body: 'Da de alta a tu equipo de entrenadores para asignarles clases.',
  },
  {
    target: 'nav-classes', path: 'classes', section: 'Operaciones',
    title: 'Clases',
    body: 'Arma el horario de clases grupales, con su cupo y su entrenador.',
  },
  {
    target: 'nav-inventory', path: 'inventory', section: 'Operaciones',
    title: 'Inventario',
    body: 'Registra tus máquinas y equipos, y el estado de cada uno.',
  },
  {
    target: 'nav-reports', path: 'reports', section: 'Gestión',
    title: 'Reportes',
    body: 'Ingresos, altas y bajas, y asistencia a lo largo del tiempo, para ver cómo crece tu gimnasio.',
  },
  {
    target: 'nav-marketing', path: 'marketing', section: 'Gestión',
    title: 'Marketing',
    body: 'Crea promociones y campañas para atraer socios nuevos y recuperar a los que se fueron.',
  },
  {
    target: 'nav-communications', path: 'communications', section: 'Gestión',
    title: 'Comunicaciones',
    body: 'Envía avisos y mensajes a tus socios.',
  },
  {
    target: 'nav-support', path: 'support', section: 'Gestión',
    title: 'Soporte',
    body: '¿Tienes dudas o algo no funciona? Escríbenos desde aquí.',
  },
  {
    target: 'search', section: 'Atajo',
    title: 'Búsqueda rápida',
    body: 'Encuentra a cualquier socio por nombre o email desde cualquier pantalla.',
    tip: 'Pulsa ⌘K (o Ctrl+K) para buscar sin usar el ratón.',
  },
  {
    target: 'tour-button', section: 'Ayuda',
    title: 'Repite el recorrido',
    body: 'Si necesitas volver a ver esta guía, pulsa este botón cuando quieras.',
  },
  {
    path: 'settings', section: 'Listo',
    title: '¡Ya conoces tu panel!',
    body: 'Ahora configura tu gimnasio, crea tu primer plan y registra a tu primer socio. ¡Mucho éxito!',
  },
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
}

export function GymTour({ gymSlug, autoStart, storeEnabled }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const steps = STEPS.filter(s => !s.storeOnly || storeEnabled)

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
            aria-label="Cerrar recorrido"
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
                Saltar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                aria-label="Paso anterior"
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
              {index === 0 ? 'Empezar' : last ? 'Ir a configurar' : 'Siguiente'}
              {!last && <ArrowRight className="size-4" strokeWidth={2.6} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
