'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { changePasswordAction } from './actions'
import { createHandlers } from '@/lib/input-validation'

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'

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
    if (next.length < 6) { setError('La nueva contraseña debe tener al menos 6 caracteres'); return }
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Contraseña actual</label>
        <div className="relative">
          <input
            type={showCurrent ? 'text' : 'password'}
            value={current}
            onChange={e => setCurrent(e.target.value)}
            required
            disabled={loading}
            placeholder="••••••••"
            className={inputClass + ' pr-11'}
            {...createHandlers('password')}
          />
          <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Nueva contraseña</label>
        <div className="relative">
          <input
            type={showNext ? 'text' : 'password'}
            value={next}
            onChange={e => setNext(e.target.value)}
            required
            disabled={loading}
            placeholder="Mínimo 6 caracteres"
            className={inputClass + ' pr-11'}
            {...createHandlers('password')}
          />
          <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
            {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Confirmar contraseña</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          disabled={loading}
          placeholder="Repetir contraseña"
          className={inputClass}
          {...createHandlers('password')}
        />
      </div>

      {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}
      {success && <p className="text-xs text-[#1fad9d] font-medium">Contraseña actualizada correctamente</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-black px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
      >
        {loading ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}
