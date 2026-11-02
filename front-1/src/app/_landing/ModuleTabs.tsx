'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import s from './landing.module.css'

export interface LandingModule {
  title: string
  headline: string
  desc: string
  /** Sample rows shown under the description: label, meta, dot color */
  rows?: [string, string, string][]
}

const STEP_MS = 5000
const pad = (n: number) => String(n).padStart(2, '0')

/** Module tabs that advance on their own every 5 s; picking one restarts the count */
export function ModuleTabs({ modules }: { modules: LandingModule[] }) {
  const [cur, setCur] = useState(0)
  // Off with reduced motion: tabs then only change when picked (the CSS also stops the bar)
  const auto = useRef(false)
  const timer = useRef<ReturnType<typeof setInterval>>(undefined)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  const start = useCallback(() => {
    clearInterval(timer.current)
    timer.current = setInterval(() => setCur(c => (c + 1) % modules.length), STEP_MS)
  }, [modules.length])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    auto.current = true
    start()
    return () => clearInterval(timer.current)
  }, [start])

  function pick(i: number, focus = false) {
    setCur(i)
    if (auto.current) start()
    if (focus) tabs.current[i]?.focus()
  }

  function onKey(e: React.KeyboardEvent) {
    const n = modules.length
    const to = { ArrowDown: cur + 1, ArrowRight: cur + 1, ArrowUp: cur - 1, ArrowLeft: cur - 1, Home: 0, End: n - 1 }[e.key]
    if (to === undefined) return
    e.preventDefault()
    pick((to + n) % n, true)
  }

  const m = modules[cur]
  return (
    <div className="mt-14 flex flex-wrap items-stretch gap-6">
      <div role="tablist" aria-label="Módulos" aria-orientation="vertical" onKeyDown={onKey} className="flex min-w-0 flex-[1_1_340px] flex-col gap-1.5">
        {modules.map((mod, i) => (
          <button
            key={mod.title}
            ref={el => { tabs.current[i] = el }}
            type="button"
            role="tab"
            id={`mod-tab-${i}`}
            aria-selected={i === cur}
            aria-controls="mod-panel"
            tabIndex={i === cur ? 0 : -1}
            onClick={() => pick(i)}
            className={`${s.tab} ${i === cur ? s.tabOn : ''}`}
          >
            <span className="flex items-center gap-3.5">
              <span className={`${s.mono} text-[13px] ${i === cur ? s.acc : 'text-[#85857f]'}`}>{pad(i + 1)}</span>
              <span className="text-[22px] font-extrabold [font-stretch:112%]">{mod.title}</span>
            </span>
            <span className="mt-2.5 block h-[3px] overflow-hidden rounded-full bg-[#232326]">
              {i === cur && <span key={cur} className={s.prog} />}
            </span>
          </button>
        ))}
      </div>

      <div
        key={cur}
        id="mod-panel"
        role="tabpanel"
        aria-labelledby={`mod-tab-${cur}`}
        className={`${s.panelIn} flex min-w-0 flex-[1.6_1_520px] flex-col gap-6 rounded-3xl border border-[#2a2a2c] bg-[#141416] p-6 sm:p-9`}
      >
        <div className={`${s.mono} ${s.acc} text-[13px]`}>{pad(cur + 1)} / {pad(modules.length)}</div>
        <h3 className="m-0 text-[32px] leading-[1.05] font-black tracking-[-0.02em] [font-stretch:115%] sm:text-[40px]">{m.headline}</h3>
        <p className="m-0 max-w-[560px] text-[17px] leading-[1.6] text-[#b4b4ae]">{m.desc}</p>
        {m.rows && m.rows.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[#232326] bg-[#0b0b0c]" aria-label="Ejemplo">
            {m.rows.map(([label, meta, dot], j) => (
              <div
                key={label}
                className={`${s.panelIn} flex items-center gap-3.5 border-t border-[#1c1c1e] px-[18px] py-3.5 first:border-t-0`}
                style={{ animationDelay: `${0.12 + j * 0.1}s` }}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
                <span className="flex-1 text-[15px] font-semibold">{label}</span>
                <span className={`${s.mono} text-[13px] text-[#a3a39d]`}>{meta}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
