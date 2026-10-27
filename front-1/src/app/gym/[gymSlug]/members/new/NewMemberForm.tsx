'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createMemberAction } from '../actions'
import { useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'
import { membersMessages } from '../messages'

type FormMessages = (typeof membersMessages)['es']['form']

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

function validateFields(data: { firstName: string; lastName: string; email: string; phone: string }, t: FormMessages): FieldErrors {
  const errors: FieldErrors = {}
  if (!data.firstName.trim()) {
    errors.firstName = t.firstNameRequired
  } else if (!LETTERS_REGEX.test(data.firstName.trim())) {
    errors.firstName = t.firstNameLetters
  }
  if (!data.lastName.trim()) {
    errors.lastName = t.lastNameRequired
  } else if (!LETTERS_REGEX.test(data.lastName.trim())) {
    errors.lastName = t.lastNameLetters
  }
  if (!data.email.trim()) {
    errors.email = t.emailRequired
  } else if (/[<>?/]/.test(data.email)) {
    errors.email = t.emailBadChars
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = t.emailFormat
  }
  if (data.phone && !/^\d+$/.test(data.phone)) {
    errors.phone = t.phoneDigits
  } else if (data.phone && data.phone.length < 7) {
    errors.phone = t.phoneMin
  }
  return errors
}

export function NewMemberForm({ gymSlug, onSuccess, onClose }: Props) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isPending, startTransition] = useTransition()
  const submittingRef = useRef(false)
  const t = useT(membersMessages).form
  const tc = useT(commonMessages)

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

    const errors = validateFields(data, t)
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
          label={t.firstName}
          name="firstName"
          placeholder={t.firstNamePlaceholder}
          disabled={isPending}
          error={fieldErrors.firstName}
          onInput={() => clearFieldError('firstName')}
        />
        <LetterField
          label={t.lastName}
          name="lastName"
          placeholder={t.lastNamePlaceholder}
          disabled={isPending}
          error={fieldErrors.lastName}
          onInput={() => clearFieldError('lastName')}
        />
      </div>

      <Field
        label={t.email}
        name="email"
        type="email"
        placeholder={t.emailPlaceholder}
        disabled={isPending}
        error={fieldErrors.email}
        onInput={() => clearFieldError('email')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PhoneField
          label={t.phone}
          name="phone"
          disabled={isPending}
          error={fieldErrors.phone}
          onInput={() => clearFieldError('phone')}
        />
        <Field
          label={t.birthDate}
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
          {isPending ? t.creating : t.create}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-zinc-600 hover:text-black border border-zinc-200 hover:border-zinc-300 transition-all disabled:opacity-50"
        >
          {tc.cancel}
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
