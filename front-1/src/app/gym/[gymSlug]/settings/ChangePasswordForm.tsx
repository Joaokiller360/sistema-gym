'use client'

import { useState } from 'react'
import { Check, Eye, EyeOff } from 'lucide-react'
import { changePasswordAction } from './actions'
import { createHandlers } from '@/lib/input-validation'

const inputClass = 'h-12 w-full rounded-xl border border-adm-line bg-adm-ground px-3.5 text-[15px] text-adm-ink outline-none transition-colors placeholder:text-adm-muted focus:border-adm-brand disabled:opacity-50'
const labelClass = 'mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-adm-muted'

/** 0–4: length plus character variety; only guidance, the server enforces the 12-char rule. */
function strength(pw: string) {
  if (!pw) return 0
  let score = pw.length >= 12 ? 2 : pw.length >= 8 ? 1 : 0
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length
  if (kinds >= 3) score++
  if (pw.length >= 16) score++
  return Math.min(4, score)
}

export function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (!current.trim()) { setError('La contraseña actual es obligatoria'); return }
    if (next.length < 12) { setError('La nueva contraseña debe tener al menos 12 caracteres'); return }
    if (next !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    const res = await changePasswordAction(current, next)
    setLoading(false)
    if (res.error) {
      setError(res.error)
    } else {
      setSuccess(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    }
  }

  const level = strength(next)
  const rules = [
    { ok: next.length >= 12, text: 'Al menos 12 caracteres' },
    { ok: next.length > 0 && next === confirm, text: 'Coincide con la repetición' },
  ]
  const toggleClass = 'absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-adm-muted hover:text-adm-ink'

  return (
    <form onSubmit={handleSubmit} aria-labelledby="password-h" className="flex flex-col gap-4 rounded-[20px] border border-adm-line bg-adm-surface p-[22px]">
      <div className="flex flex-col gap-1">
        <h2 id="password-h" className="text-[17px] font-extrabold">Tu contraseña</h2>
        <p className="text-[13px] text-adm-muted">Solo cambia la de tu cuenta.</p>
      </div>

      <div>
        <label htmlFor="pw-current" className={labelClass}>Actual</label>
        <div className="relative">
          <input
            id="pw-current"
            type={showCurrent ? 'text' : 'password'}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            required
            disabled={loading}
            autoComplete="current-password"
            placeholder="••••••••"
            className={`${inputClass} pr-12`}
            {...createHandlers('password')}
          />
          <button type="button" onClick={() => setShowCurrent(v => !v)} aria-label={showCurrent ? 'Ocultar contraseña' : 'Mostrar contraseña'} className={toggleClass}>
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="pw-next" className={labelClass}>Nueva</label>
        <div className="relative">
          <input
            id="pw-next"
            type={showNext ? 'text' : 'password'}
            value={next}
            onChange={e => setNext(e.target.value)}
            required
            disabled={loading}
            autoComplete="new-password"
            placeholder="Mínimo 12 caracteres"
            className={`${inputClass} pr-12`}
            {...createHandlers('password')}
          />
          <button type="button" onClick={() => setShowNext(v => !v)} aria-label={showNext ? 'Ocultar contraseña' : 'Mostrar contraseña'} className={toggleClass}>
            {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-2.5 grid grid-cols-4 gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`h-1.5 rounded-full ${i < level ? 'bg-adm-brand' : 'bg-adm-line'}`} />
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {rules.map(r => (
          <li key={r.text} className={`flex items-center gap-2 text-[13px] ${r.ok ? 'text-adm-ink' : 'text-adm-muted'}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${r.ok ? 'bg-adm-brand text-adm-night' : 'border border-adm-line'}`}>
              {r.ok && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
            </span>
            {r.text}
          </li>
        ))}
      </ul>

      <div>
        <label htmlFor="pw-confirm" className={labelClass}>Repetir</label>
        <input
          id="pw-confirm"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          disabled={loading}
          autoComplete="new-password"
          placeholder="Repetir contraseña"
          className={inputClass}
          {...createHandlers('password')}
        />
      </div>

      {error && <p role="alert" className="text-xs font-medium text-adm-bad-fg">{error}</p>}
      {success && <p role="status" className="text-xs font-medium text-adm-ok-fg">Contraseña actualizada correctamente</p>}

      <button
        type="submit"
        disabled={loading}
        className="h-12 rounded-xl border border-adm-ink text-sm font-extrabold transition-colors hover:bg-adm-chip disabled:opacity-50"
      >
        {loading ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}
