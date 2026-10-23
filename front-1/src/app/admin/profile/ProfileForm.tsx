'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { updateAdminProfileAction, changeAdminPasswordAction } from './actions'
import { createHandlers } from '@/lib/input-validation'
import { cn } from '@/lib/utils'
import { btn, field } from '@/components/admin/ui'

const inputClass = field.input
const labelClass = field.label

export function ProfileInfoForm({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setLoading(true)
    const res = await updateAdminProfileAction({ name: name.trim(), email: email.trim() })
    setLoading(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Perfil actualizado')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="pf-name" className={labelClass}>Nombre</label>
        <input
          type="text"
          id="pf-name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          disabled={loading}
          className={inputClass}
          {...createHandlers('text')}
        />
      </div>
      <div>
        <label htmlFor="pf-email" className={labelClass}>Correo electrónico</label>
        <input
          type="email"
          id="pf-email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          disabled={loading}
          className={inputClass}
          {...createHandlers('email')}
        />
      </div>
      <div className="pt-1">
        <button
          type="submit"
          disabled={loading}
          className={cn(btn.dark, 'min-h-11 px-5 text-sm')}
        >
          {loading ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

export function AdminChangePasswordForm() {
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
    const res = await changeAdminPasswordAction(current, next)
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
      <div>
        <label htmlFor="pf-current" className={labelClass}>Contraseña actual</label>
        <div className="relative">
          <input
            type={showCurrent ? 'text' : 'password'}
            id="pf-current"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            required
            disabled={loading}
            placeholder="••••••••"
            className={inputClass + ' pr-11'}
            {...createHandlers('password')}
          />
          <button type="button" onClick={() => setShowCurrent(v => !v)} aria-label={showCurrent ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-adm-muted hover:text-adm-ink">
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="pf-new" className={labelClass}>Nueva contraseña</label>
        <div className="relative">
          <input
            type={showNext ? 'text' : 'password'}
            id="pf-new"
            value={next}
            onChange={e => setNext(e.target.value)}
            required
            disabled={loading}
            placeholder="Mínimo 6 caracteres"
            className={inputClass + ' pr-11'}
            {...createHandlers('password')}
          />
          <button type="button" onClick={() => setShowNext(v => !v)} aria-label={showNext ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-adm-muted hover:text-adm-ink">
            {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label htmlFor="pf-confirm" className={labelClass}>Confirmar contraseña</label>
        <input
          type="password"
          id="pf-confirm"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          disabled={loading}
          placeholder="Repetir contraseña"
          className={inputClass}
          {...createHandlers('password')}
        />
      </div>
      {error && <p role="alert" className={field.error}>{error}</p>}
      {success && <p role="status" className="text-xs font-semibold text-adm-ok-fg">Contraseña actualizada correctamente</p>}
      <div className="pt-1">
        <button
          type="submit"
          disabled={loading}
          className={cn(btn.dark, 'min-h-11 px-5 text-sm')}
        >
          {loading ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </div>
    </form>
  )
}
