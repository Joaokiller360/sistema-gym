'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import jsQR from 'jsqr'
import { Camera, CameraOff, CheckCircle2, LogIn, Minus, Plus, QrCode, Receipt, Search, ShoppingBag, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, Pill, btn, field, initials } from '@/components/admin/ui'
import { scanCodeAction, scanCheckInAction, scanSaleAction, scanCreditAction, type ScanResult } from './actions'

export interface ScanProduct {
  id: string
  name: string
  price: number
  stock: number
}

type Mode = 'idle' | 'sale' | 'credit'
type CameraState = 'off' | 'starting' | 'on' | 'error'

const METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'OTHER', label: 'Otro' },
] as const

interface LogEntry {
  id: number
  name: string
  text: string
  at: string
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

function money(n: number) {
  return `$${n.toLocaleString('es-AR')}`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ScanClient({ gymSlug, products }: { gymSlug: string; products: ScanProduct[] }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const lastScanRef = useRef({ code: '', at: 0 })
  const logId = useRef(0)

  const [camera, setCamera] = useState<CameraState>('off')
  const [cameraError, setCameraError] = useState('')
  const [manual, setManual] = useState('')

  const [code, setCode] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)

  const [mode, setMode] = useState<Mode>('idle')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [productQuery, setProductQuery] = useState('')
  const [method, setMethod] = useState<(typeof METHODS)[number]['value']>('CASH')
  const [notes, setNotes] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [isPending, startTransition] = useTransition()

  // Scanning another code is allowed unless the cashier is mid-way through a sale or fiado.
  useEffect(() => {
    busyRef.current = looking || mode !== 'idle'
  }, [looking, mode])

  useEffect(() => () => stopCamera(), [])

  async function lookup(raw: string) {
    const value = raw.trim()
    if (!value) return
    setLooking(true)
    setLookupError(null)
    setDone(null)
    setActionError(null)
    const res = await scanCodeAction(gymSlug, value)
    setLooking(false)
    if (res.error || !res.data) {
      setLookupError(res.error ?? 'No se pudo leer el código')
      setResult(null)
      setCode(null)
      return
    }
    setCode(value)
    setResult(res.data)
    setMode('idle')
    setCart({})
    setNotes('')
  }

  function onDetected(value: string) {
    const now = Date.now()
    if (busyRef.current) return
    if (value === lastScanRef.current.code && now - lastScanRef.current.at < 4000) return
    lastScanRef.current = { code: value, at: now }
    void lookup(value)
  }

  function stopCamera() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  async function startCamera() {
    setCameraError('')
    setCamera('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setCamera('on')

      const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector
      const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null

      const tick = async () => {
        if (!streamRef.current) return
        if (!busyRef.current && video.readyState >= 2 && video.videoWidth > 0) {
          let value: string | null = null
          if (detector) {
            try {
              value = (await detector.detect(video))[0]?.rawValue ?? null
            } catch {
              value = null
            }
          } else if (canvasRef.current) {
            const scale = Math.min(1, 640 / video.videoWidth)
            const w = Math.round(video.videoWidth * scale)
            const h = Math.round(video.videoHeight * scale)
            const canvas = canvasRef.current
            canvas.width = w
            canvas.height = h
            const ctx = canvas.getContext('2d', { willReadFrequently: true })
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h)
              value = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null
            }
          }
          if (value) onDetected(value)
        }
        timerRef.current = window.setTimeout(tick, 200)
      }
      void tick()
    } catch (e) {
      stopCamera()
      setCamera('error')
      const name = (e as { name?: string })?.name
      setCameraError(
        name === 'NotAllowedError'
          ? 'Sin permiso para usar la cámara. Habilitalo en el navegador o usá el lector / el campo de texto.'
          : 'No se pudo abrir la cámara en este dispositivo.',
      )
    }
  }

  function toggleCamera() {
    if (camera === 'on' || camera === 'starting') {
      stopCamera()
      setCamera('off')
    } else {
      void startCamera()
    }
  }

  function clearMember() {
    setCode(null)
    setResult(null)
    setLookupError(null)
    setMode('idle')
    setCart({})
    setNotes('')
    setDone(null)
    setActionError(null)
    lastScanRef.current = { code: '', at: 0 }
    inputRef.current?.focus()
  }

  function addLog(text: string) {
    if (!result) return
    const entry = { id: ++logId.current, name: `${result.member.firstName} ${result.member.lastName}`, text, at: new Date().toISOString() }
    setLog(prev => [entry, ...prev].slice(0, 12))
  }

  async function refreshSummary() {
    if (!code) return
    const res = await scanCodeAction(gymSlug, code)
    if (res.data) setResult(res.data)
  }

  const items = Object.entries(cart).filter(([, q]) => q > 0).map(([productId, quantity]) => ({ productId, quantity }))
  const total = items.reduce((sum, i) => sum + (products.find(p => p.id === i.productId)?.price ?? 0) * i.quantity, 0)

  function runAction(kind: 'checkin' | 'sale' | 'credit') {
    if (!code || !result) return
    setActionError(null)
    setDone(null)
    startTransition(async () => {
      const res =
        kind === 'checkin'
          ? await scanCheckInAction(gymSlug, code)
          : kind === 'sale'
            ? await scanSaleAction(gymSlug, code, { items, method, notes: notes.trim() || undefined })
            : await scanCreditAction(gymSlug, code, result.member.id, { items, notes: notes.trim() || undefined })
      if (res.error) {
        setActionError(res.error)
        return
      }
      const remaining = 'visitsRemaining' in res ? res.visitsRemaining : null
      const message =
        kind === 'checkin'
          ? remaining != null
            ? `Asistencia registrada · ${remaining === 0 ? 'usó su último día del plan' : `quedan ${remaining} días`}`
            : 'Asistencia registrada'
          : kind === 'sale'
            ? `Compra registrada · ${money(total)}`
            : `Fiado anotado · ${money(total)}`
      setDone(message)
      addLog(message)
      setMode('idle')
      setCart({})
      setNotes('')
      await refreshSummary()
    })
  }

  function setQty(productId: string, next: number) {
    const product = products.find(p => p.id === productId)
    if (!product) return
    setCart(prev => ({ ...prev, [productId]: Math.max(0, Math.min(product.stock, next)) }))
  }

  const q = productQuery.trim().toLowerCase()
  const shownProducts = products.filter(p => !q || p.name.toLowerCase().includes(q))

  return (
    <div className="flex flex-wrap items-start gap-4">
      {/* Scanner */}
      <section aria-label="Lector" className="flex min-w-0 flex-[1_1_360px] flex-col gap-4 rounded-2xl border border-adm-line bg-adm-surface p-5">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-adm-night">
          <video ref={videoRef} muted playsInline className={cn('size-full object-cover', camera !== 'on' && 'invisible')} />
          <canvas ref={canvasRef} className="hidden" />
          {camera === 'on' ? (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative size-[58%] max-h-[80%] rounded-2xl border-[3px] border-adm-brand shadow-[0_0_0_9999px_rgba(11,11,12,0.45)]">
                <span className="absolute inset-x-3 top-1/2 h-0.5 rounded-full bg-adm-brand shadow-[0_0_14px_#fffb00] motion-safe:animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <QrCode className="size-12 text-adm-brand" aria-hidden="true" />
              <p className="text-sm text-[#a3a39d]">
                {camera === 'starting' ? 'Abriendo cámara…' : 'Activá la cámara o usá un lector de códigos.'}
              </p>
            </div>
          )}
        </div>

        <button type="button" onClick={toggleCamera} className={cn(camera === 'on' ? btn.line : btn.primary, 'min-h-11')}>
          {camera === 'on' ? <CameraOff className="size-4" aria-hidden="true" /> : <Camera className="size-4" aria-hidden="true" />}
          {camera === 'on' ? 'Apagar cámara' : 'Activar cámara'}
        </button>
        {cameraError && <p role="alert" className={field.error}>{cameraError}</p>}

        <form
          onSubmit={e => {
            e.preventDefault()
            const value = manual
            setManual('')
            void lookup(value)
          }}
        >
          <label htmlFor="scan-code" className={field.label}>Lector USB o código manual</label>
          <div className="flex gap-2">
            <input
              id="scan-code"
              ref={inputRef}
              value={manual}
              onChange={e => setManual(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder="GYMOS-…"
              className={cn(field.input, 'font-admin-mono')}
            />
            <button type="submit" disabled={!manual.trim() || looking} className={cn(btn.dark, 'min-h-11')}>
              Buscar
            </button>
          </div>
          <p className={field.hint}>Los lectores USB escriben el código y presionan Enter solos.</p>
        </form>
      </section>

      {/* Member + actions */}
      <section aria-label="Socio escaneado" aria-live="polite" className="flex min-w-0 flex-[1.4_1_440px] flex-col gap-4">
        <div className="rounded-2xl border border-adm-line bg-adm-surface p-5">
          {looking ? (
            <p className="py-10 text-center text-sm text-adm-muted">Buscando socio…</p>
          ) : lookupError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-adm-bad-bg">
                <X className="size-6 text-adm-bad-fg" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-adm-bad-fg">{lookupError}</p>
              <button type="button" onClick={clearMember} className={btn.line}>Volver a escanear</button>
            </div>
          ) : !result ? (
            <EmptyState icon={<QrCode className="size-10" />}>Esperando un código…</EmptyState>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-start gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-adm-ink text-xl font-extrabold text-adm-surface">
                  {result.member.photoUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={result.member.photoUrl} alt="" className="size-full object-cover" />
                    : initials(`${result.member.firstName} ${result.member.lastName}`)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-2xl font-extrabold">{result.member.firstName} {result.member.lastName}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.membership.active ? (
                      <Pill tone="ok">{result.membership.planName} · vence {fmtDate(result.membership.endDate!)}</Pill>
                    ) : result.membership.visitsRemaining === 0 ? (
                      <Pill tone="bad">{result.membership.planName}: usó sus {result.membership.visitsTotal} días</Pill>
                    ) : (
                      <Pill tone="bad">Sin membresía activa</Pill>
                    )}
                    {result.membership.active && result.membership.visitsRemaining != null && (
                      <Pill tone={result.membership.visitsRemaining <= 2 ? 'warn' : 'info'}>
                        Quedan {result.membership.visitsRemaining} de {result.membership.visitsTotal} días
                      </Pill>
                    )}
                    {result.checkedInToday && <Pill tone="info">Entró hoy {fmtTime(result.checkedInToday)}</Pill>}
                    {!result.member.isActive && <Pill>Socio inactivo</Pill>}
                  </div>
                </div>
                <button type="button" onClick={clearMember} aria-label="Siguiente socio" className={btn.icon}>
                  <X className="size-4" />
                </button>
              </div>

              <div className={cn(
                'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm',
                result.pendingCredits.count > 0 ? 'border-adm-warn-line bg-adm-warn-bg text-adm-warn-fg' : 'border-adm-line-soft bg-adm-subtle text-adm-muted',
              )}>
                <span className="font-semibold">Fiado pendiente</span>
                <span className="font-admin-mono font-bold">
                  {result.pendingCredits.count > 0
                    ? `${money(result.pendingCredits.total)} · ${result.pendingCredits.count} ítem${result.pendingCredits.count !== 1 ? 's' : ''}`
                    : 'Nada pendiente'}
                </span>
              </div>

              {done && (
                <p role="status" className="flex items-center gap-2 rounded-xl border border-adm-ok-line bg-adm-ok-bg px-4 py-3 text-sm font-semibold text-adm-ok-fg">
                  <CheckCircle2 className="size-4" aria-hidden="true" /> {done}
                </p>
              )}
              {actionError && <p role="alert" className="rounded-xl border border-adm-bad-line bg-adm-bad-bg px-4 py-3 text-sm font-semibold text-adm-bad-fg">{actionError}</p>}

              {mode === 'idle' ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runAction('checkin')}
                    disabled={isPending || !!result.checkedInToday}
                    className={cn(btn.primary, 'min-h-14 flex-[1_1_100%] text-base')}
                  >
                    <LogIn className="size-5" aria-hidden="true" />
                    {result.checkedInToday ? 'Asistencia ya registrada hoy' : isPending ? 'Registrando…' : 'Registrar asistencia'}
                  </button>
                  <button type="button" onClick={() => { setMode('sale'); setDone(null) }} disabled={isPending || products.length === 0} className={cn(btn.line, 'min-h-12 flex-1 text-sm')}>
                    <ShoppingBag className="size-4" aria-hidden="true" /> Compró algo
                  </button>
                  <button type="button" onClick={() => { setMode('credit'); setDone(null) }} disabled={isPending || products.length === 0} className={cn(btn.line, 'min-h-12 flex-1 text-sm')}>
                    <Receipt className="size-4" aria-hidden="true" /> Fiado
                  </button>
                  {products.length === 0 && <p className="w-full text-xs text-adm-muted">No hay productos activos en la tienda para registrar compras o fiados.</p>}
                </div>
              ) : (
                <div className="flex flex-col gap-4 rounded-xl border-2 border-adm-ink p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-bold">{mode === 'sale' ? 'Registrar compra' : 'Anotar fiado'}</p>
                    <button type="button" onClick={() => { setMode('idle'); setCart({}) }} aria-label="Cancelar" className={btn.icon}><X className="size-4" /></button>
                  </div>

                  <label className="relative flex items-center">
                    <span className="sr-only">Buscar producto</span>
                    <Search className="pointer-events-none absolute left-3 size-4 text-adm-muted" aria-hidden="true" />
                    <input type="search" value={productQuery} onChange={e => setProductQuery(e.target.value)} placeholder="Buscar producto" className={cn(field.input, 'min-h-10 pl-9')} />
                  </label>

                  <ul className="max-h-64 overflow-y-auto rounded-xl border border-adm-line-soft">
                    {shownProducts.map(p => {
                      const qty = cart[p.id] ?? 0
                      return (
                        <li key={p.id} className={cn('flex items-center gap-3 border-t border-adm-line-soft px-3 py-2.5 first:border-t-0', qty > 0 && 'bg-adm-subtle')}>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{p.name}</p>
                            <p className="text-xs text-adm-muted">{money(p.price)} · stock {p.stock}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setQty(p.id, qty - 1)} disabled={qty === 0} aria-label={`Quitar ${p.name}`} className={cn(btn.icon, 'size-9')}><Minus className="size-4" /></button>
                            <span className="w-6 text-center font-admin-mono text-sm font-bold">{qty}</span>
                            <button type="button" onClick={() => setQty(p.id, qty + 1)} disabled={qty >= p.stock} aria-label={`Agregar ${p.name}`} className={cn(btn.icon, 'size-9')}><Plus className="size-4" /></button>
                          </div>
                        </li>
                      )
                    })}
                    {shownProducts.length === 0 && <li className="px-3 py-4 text-center text-sm text-adm-muted">Sin resultados</li>}
                  </ul>

                  {mode === 'sale' && (
                    <div role="radiogroup" aria-label="Método de pago" className="flex flex-wrap gap-2">
                      {METHODS.map(m => (
                        <button
                          key={m.value}
                          type="button"
                          role="radio"
                          aria-checked={method === m.value}
                          onClick={() => setMethod(m.value)}
                          className={cn(
                            'min-h-10 rounded-lg border px-3.5 text-[13px] font-semibold transition-colors',
                            method === m.value ? 'border-adm-ink bg-adm-ink text-adm-surface' : 'border-adm-line bg-adm-surface hover:border-adm-ink',
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <label className="block">
                    <span className={field.label}>Nota (opcional)</span>
                    <input value={notes} onChange={e => setNotes(e.target.value)} maxLength={300} placeholder={mode === 'credit' ? 'Ej. paga el viernes' : ''} className={field.input} />
                  </label>

                  <button type="button" onClick={() => runAction(mode)} disabled={isPending || items.length === 0} className={cn(btn.dark, 'min-h-12 text-sm')}>
                    {isPending ? 'Guardando…' : `${mode === 'sale' ? 'Registrar compra' : 'Anotar fiado'} · ${money(total)}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {log.length > 0 && (
          <div className="rounded-2xl border border-adm-line bg-adm-surface">
            <p className="border-b border-adm-line-soft px-5 py-3.5 text-[15px] font-bold">En este turno</p>
            <ul>
              {log.map(l => (
                <li key={l.id} className="flex items-center gap-3 border-t border-adm-line-soft px-5 py-3 text-sm first:border-t-0">
                  <span className="font-admin-mono text-xs text-adm-muted">{fmtTime(l.at)}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
                  <span className="shrink-0 text-adm-muted">{l.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
