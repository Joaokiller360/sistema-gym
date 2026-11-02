'use client'

import { useEffect, useState } from 'react'
import s from './landing.module.css'

// Sample members for the illustration; nothing here comes from a real gym
const PEOPLE = [
  { ini: 'SV', name: 'Sofía Vera', plan: 'Mensual libre' },
  { ini: 'NR', name: 'Nicolás Ruiz', plan: 'Trimestral' },
  { ini: 'AL', name: 'Ana López', plan: 'Funcional 3x' },
  { ini: 'TB', name: 'Tomás Benítez', plan: 'Clase suelta' },
  { ini: 'MC', name: 'Mía Castro', plan: 'Mensual libre' },
  { ini: 'JP', name: 'Juan Pérez', plan: 'Musculación' },
]
const HEIGHTS = [18, 34, 62, 80, 55, 38, 30, 44, 70, 92, 66, 40]
const PEAK = 9

/** Hero illustration: a check-in counter and feed that tick like a real day at the front desk */
export function LiveCheckins() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setTick(t => t + 1), 2800)
    return () => clearInterval(id)
  }, [])

  const at = (k: number) => PEOPLE[(((tick - k) % PEOPLE.length) + PEOPLE.length) % PEOPLE.length]
  const latest = at(0)

  return (
    <div className={`${s.rise} ${s.d3} relative min-h-[520px] min-w-0 flex-[1_1_440px]`} aria-hidden="true">
      <div className={`${s.spin} absolute -top-10 -right-10 size-[220px] rounded-full border border-dashed border-[#3a3a3d]`} />
      <div className={`${s.float} relative mt-[30px] ml-auto max-w-[440px] rounded-[20px] border border-[#2a2a2c] bg-[#141416] p-[22px] shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]`}>
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-bold text-[#a3a39d]">Check-ins de hoy</div>
          <div className={`${s.acc} flex items-center gap-1.5 text-xs font-bold`}>
            <span className={`${s.live} size-[7px]`} />
            EN VIVO
          </div>
        </div>
        <div className={`${s.mono} mt-2 text-[64px] leading-[1.1] font-bold tracking-[-0.03em]`}>
          <span key={tick} className={s.pop}>{128 + tick}</span>
        </div>
        <div className="mt-3.5 flex h-[90px] items-end gap-1.5">
          {HEIGHTS.map((h, i) => (
            <div
              key={i}
              className={`${s.bar} ${i === PEAK ? s.barPeak : ''}`}
              style={{ height: `${h}%`, animationDelay: `${i * 0.06}s` }}
            />
          ))}
        </div>
        <div className={`${s.mono} mt-1.5 flex justify-between text-[11px] text-[#85857f]`}>
          <span>06 h</span><span>12 h</span><span>18 h</span><span>22 h</span>
        </div>
        <div className="mt-[18px] flex flex-col gap-2">
          <div key={tick} className={`${s.feedNew} flex items-center gap-3 rounded-xl border border-[#2a2a2c] bg-[#141416] px-3 py-2.5`}>
            <span className="flex size-[34px] items-center justify-center rounded-full bg-(--acc) text-xs font-black text-[#0b0b0c]">{latest.ini}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{latest.name}</span>
              <span className="block text-xs text-[#a3a39d]">{latest.plan}</span>
            </span>
            <span className={`${s.acc} text-xs font-bold`}>Ahora</span>
          </div>
          {[1, 2].map((k, i) => {
            const p = at(k)
            return (
              <div key={k} className="flex items-center gap-3 rounded-xl border border-[#1f1f22] px-3 py-2.5" style={{ opacity: i === 0 ? 0.85 : 0.55 }}>
                <span className="flex size-[34px] items-center justify-center rounded-full bg-[#2a2a2c] text-xs font-black">{p.ini}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{p.name}</span>
                  <span className="block text-xs text-[#a3a39d]">{p.plan}</span>
                </span>
                <span className="text-xs text-[#85857f]">hace {k * 3} min</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className={`${s.float2} absolute bottom-0 left-0 w-[230px] rounded-2xl bg-(--acc) px-[18px] py-4 text-[#0b0b0c] shadow-[0_30px_60px_-30px_rgba(0,0,0,.9)]`}>
        <div className="text-xs font-extrabold tracking-[0.06em] uppercase">Recordatorio enviado</div>
        <div className="mt-1.5 text-[15px] leading-[1.35] font-bold">Membresía de Sofía V. vence en 2 días</div>
      </div>
    </div>
  )
}
