'use client'

import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Panel, Pill, btn, type Tone } from '@/components/admin/ui'
import { checkApiHealthAction, type ApiHealth } from './health-actions'

const POLL_MS = 5 * 60_000
const HISTORY = 20
const SLOW_MS = 1000

const HTTP_TEXT: Record<number, string> = {
  200: 'OK',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

function toneOf(h: ApiHealth): Tone {
  if (h.httpStatus === null || h.httpStatus >= 500 || h.db === 'down') return 'bad'
  if (h.httpStatus >= 300 || h.latencyMs > SLOW_MS) return 'warn'
  return 'ok'
}

const HEADLINE: Record<Tone, string> = {
  ok: 'Servicio funcionando',
  warn: 'Servicio con demoras',
  bad: 'Servicio caído',
  info: '',
  high: '',
  neutral: 'Revisando…',
}

const DOT: Record<Tone, string> = {
  ok: 'bg-[#1fad9d]',
  warn: 'bg-[#e8a317]',
  bad: 'bg-[#e5484d]',
  info: 'bg-adm-muted',
  high: 'bg-adm-muted',
  neutral: 'bg-adm-muted',
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d} d ${h} h`
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

// Server and browser can differ in time zone and ICU output, so times render client-side only
const noop = () => () => {}
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false)

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <div className="flex min-w-0 flex-1 basis-32 flex-col gap-1">
      <span className="text-xs font-semibold text-adm-muted">{label}</span>
      <span
        className={cn(
          'font-admin-mono text-[15px] font-bold',
          tone === 'bad' && 'text-adm-bad-fg',
          tone === 'warn' && 'text-adm-warn-fg',
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function ApiHealthPanel({ initial }: { initial: ApiHealth | null }) {
  const [history, setHistory] = useState<ApiHealth[]>(initial ? [initial] : [])
  const [failed, setFailed] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const hydrated = useHydrated()

  const check = useCallback(() => {
    startTransition(async () => {
      const res = await checkApiHealthAction().catch(() => ({ error: 'No se pudo ejecutar la revisión' }))
      if ('httpStatus' in res) {
        setFailed(null)
        setHistory((h) => [...h, res].slice(-HISTORY))
      } else {
        setFailed(res.error)
      }
    })
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') check()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [check])

  const last = history.at(-1)
  const tone: Tone = last ? toneOf(last) : 'neutral'
  const okCount = history.filter((h) => toneOf(h) !== 'bad').length
  const maxLatency = Math.max(SLOW_MS, ...history.map((h) => h.latencyMs))

  return (
    <Panel
      title="Estado del servicio"
      id="health-h"
      action={
        <button type="button" onClick={check} disabled={isPending} className={btn.line}>
          <RefreshCw className={cn('size-3.5', isPending && 'animate-spin')} aria-hidden="true" />
          {isPending ? 'Revisando…' : 'Revisar ahora'}
        </button>
      }
      bodyClassName="flex flex-col gap-5 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="relative flex size-3" aria-hidden="true">
            {tone === 'ok' && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', DOT[tone])} />}
            <span className={cn('relative size-3 rounded-full', DOT[tone])} />
          </span>
          <div>
            <p className="text-base font-bold">{HEADLINE[tone]}</p>
            <p className="text-xs text-adm-muted">
              {last ? `Última revisión ${hydrated ? fmtTime(last.checkedAt) : '…'} · se repite cada ${POLL_MS / 60_000} min` : 'Sin datos todavía'}
            </p>
          </div>
        </div>
        {last && (
          <Pill tone={tone} className="font-admin-mono text-[13px]">
            {last.httpStatus === null ? 'Sin respuesta' : `${last.httpStatus} ${HTTP_TEXT[last.httpStatus] ?? ''}`.trim()}
          </Pill>
        )}
      </div>

      {(last?.error || failed) && (
        <p role="alert" className="rounded-lg border border-adm-bad-line bg-adm-bad-bg px-3.5 py-2.5 text-[13px] font-semibold text-adm-bad-fg">
          {failed ?? last?.error}
        </p>
      )}

      {last && (
        <div className="flex flex-wrap gap-4 border-t border-adm-line-soft pt-4">
          <Metric label="Respuesta" value={`${last.latencyMs} ms`} tone={last.latencyMs > SLOW_MS ? 'warn' : undefined} />
          <Metric
            label="Base de datos"
            value={last.db === 'ok' ? `OK · ${last.dbLatencyMs ?? '—'} ms` : last.db === 'down' ? 'Caída' : '—'}
            tone={last.db === 'down' ? 'bad' : undefined}
          />
          <Metric label="Encendida hace" value={last.uptimeSeconds !== null ? fmtUptime(last.uptimeSeconds) : '—'} />
          <Metric label="Revisiones OK" value={`${okCount} / ${history.length}`} tone={okCount < history.length ? 'warn' : undefined} />
        </div>
      )}

      {history.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-adm-muted">Tiempo de respuesta · últimas {history.length} revisiones</p>
          <ol className="flex h-10 items-end gap-[2px]" aria-label="Historial de revisiones">
            {history.map((h) => {
              const t = toneOf(h)
              const label = `${fmtTime(h.checkedAt)}: ${h.httpStatus ?? 'sin respuesta'} · ${h.latencyMs} ms`
              return (
                <li
                  key={h.checkedAt}
                  title={label}
                  className="flex h-full max-w-4 flex-1 items-end"
                >
                  <span className="sr-only">{label}</span>
                  <span
                    className={cn('w-full rounded-t-[3px]', DOT[t])}
                    style={{ height: `${t === 'bad' ? 100 : Math.max(12, (h.latencyMs / maxLatency) * 100)}%` }}
                  />
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </Panel>
  )
}
