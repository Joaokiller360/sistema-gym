'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createMemberAction } from '../actions'

interface Props {
  gymSlug: string
  onSuccess?: (memberId: string) => void
  onClose?: () => void
}

interface FieldErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

const LETTERS_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/
// Strict: only alphanumeric + . _ % + - in local part, no < > ? / or other special chars
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

function validateFields(data: { firstName: string; lastName: string; email: string; phone: string }): FieldErrors {
  const errors: FieldErrors = {}
  if (!data.firstName.trim()) {
    errors.firstName = 'El nombre es obligatorio'
  } else if (!LETTERS_REGEX.test(data.firstName.trim())) {
    errors.firstName = 'El nombre solo puede contener letras'
  }
  if (!data.lastName.trim()) {
    errors.lastName = 'El apellido es obligatorio'
  } else if (!LETTERS_REGEX.test(data.lastName.trim())) {
    errors.lastName = 'El apellido solo puede contener letras'
  }
  if (!data.email.trim()) {
    errors.email = 'El email es obligatorio'
  } else if (/[<>?/]/.test(data.email)) {
    errors.email = 'El email contiene caracteres no permitidos'
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = 'El email no tiene un formato válido (ej: usuario@dominio.com)'
  }
  if (data.phone && !/^\d+$/.test(data.phone)) {
    errors.phone = 'El teléfono solo puede contener números'
  } else if (data.phone && data.phone.length < 7) {
    errors.phone = 'El teléfono debe tener al menos 7 dígitos'
  }
  return errors
}

export function NewMemberForm({ gymSlug, onSuccess, onClose }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isPending, startTransition] = useTransition()
  const submittingRef = useRef(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submittingRef.current) return
    setServerError(null)
    const fd = new FormData(e.currentTarget)
    const data = {
      firstName: fd.get('firstName') as string,
      lastName: fd.get('lastName') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
      birthDate: fd.get('birthDate') as string,
    }

    const errors = validateFields(data)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    submittingRef.current = true

    startTransition(async () => {
      try {
        const result = await createMemberAction(gymSlug, data)
        if ('error' in result) {
          setServerError(result.error)
          return
        }
        if (onSuccess) {
          onSuccess(result.memberId)
        } else {
          router.push(`/gym/${gymSlug}/members`)
        }
      } finally {
        submittingRef.current = false
      }
    })
  }

  function handleCancel() {
    if (onClose) {
      onClose()
    } else {
      router.push(`/gym/${gymSlug}/members`)
    }
  }

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors(prev => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LetterField
          label="Nombre *"
          name="firstName"
          placeholder="Juan"
          disabled={isPending}
          error={fieldErrors.firstName}
          onInput={() => clearFieldError('firstName')}
        />
        <LetterField
          label="Apellido *"
          name="lastName"
          placeholder="Pérez"
          disabled={isPending}
          error={fieldErrors.lastName}
          onInput={() => clearFieldError('lastName')}
        />
      </div>

      <Field
        label="Email *"
        name="email"
        type="email"
        placeholder="juan@email.com"
        disabled={isPending}
        error={fieldErrors.email}
        onInput={() => clearFieldError('email')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PhoneField
          label="Teléfono"
          name="phone"
          disabled={isPending}
          error={fieldErrors.phone}
          onInput={() => clearFieldError('phone')}
        />
        <Field
          label="Fecha de nacimiento"
          name="birthDate"
          type="date"
          disabled={isPending}
          max={new Date().toISOString().slice(0, 10)}
        />
      </div>

      {serverError && (
        <div className="rounded-xl bg-[#ff0000]/8 border border-[#ff0000]/20 px-4 py-3 text-sm text-[#cc0000] font-medium">
          {serverError}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-black px-6 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {isPending ? 'Creando…' : 'Crear miembro'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-zinc-600 hover:text-black border border-zinc-200 hover:border-zinc-300 transition-all disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  disabled,
  error,
  onInput,
  max,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  onInput?: () => void
  max?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        onInput={onInput}
        max={max}
        className={`w-full rounded-xl border bg-zinc-50 px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 transition-all ${
          error
            ? 'border-[#ff0000]/60 focus:ring-[#ff0000]/30'
            : 'border-zinc-200 focus:ring-[#1fad9d]'
        }`}
      />
      {error && <p className="text-xs text-[#cc0000] font-medium">{error}</p>}
    </div>
  )
}

function LetterField({
  label,
  name,
  placeholder,
  disabled,
  error,
  onInput,
}: {
  label: string
  name: string
  placeholder?: string
  disabled?: boolean
  error?: string
  onInput?: () => void
}) {
  function handleInput(e: React.FormEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const filtered = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]/g, '')
    if (input.value !== filtered) input.value = filtered
    onInput?.()
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <input
        name={name}
        type="text"
        placeholder={placeholder}
        disabled={disabled}
        onInput={handleInput}
        className={`w-full rounded-xl border bg-zinc-50 px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 transition-all ${
          error
            ? 'border-[#ff0000]/60 focus:ring-[#ff0000]/30'
            : 'border-zinc-200 focus:ring-[#1fad9d]'
        }`}
      />
      {error && <p className="text-xs text-[#cc0000] font-medium">{error}</p>}
    </div>
  )
}

function PhoneField({
  label,
  name,
  disabled,
  error,
  onInput,
}: {
  label: string
  name: string
  disabled?: boolean
  error?: string
  onInput?: () => void
}) {
  function handleInput(e: React.FormEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const filtered = input.value.replace(/\D/g, '').slice(0, 10)
    if (input.value !== filtered) input.value = filtered
    onInput?.()
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <input
        name={name}
        type="text"
        inputMode="numeric"
        maxLength={10}
        placeholder="0986660737"
        disabled={disabled}
        onInput={handleInput}
        className={`w-full rounded-xl border bg-zinc-50 px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 transition-all ${
          error
            ? 'border-[#ff0000]/60 focus:ring-[#ff0000]/30'
            : 'border-zinc-200 focus:ring-[#1fad9d]'
        }`}
      />
      {error && <p className="text-xs text-[#cc0000] font-medium">{error}</p>}
    </div>
  )
}
