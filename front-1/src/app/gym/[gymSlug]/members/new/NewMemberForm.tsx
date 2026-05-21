'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createMemberAction } from '../actions'

interface Props {
  gymSlug: string
}

export function NewMemberForm({ gymSlug }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const data = {
      firstName: fd.get('firstName') as string,
      lastName: fd.get('lastName') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
      birthDate: fd.get('birthDate') as string,
    }
    startTransition(async () => {
      const result = await createMemberAction(gymSlug, data)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre *" name="firstName" placeholder="Juan" required disabled={isPending} />
        <Field label="Apellido *" name="lastName" placeholder="Pérez" required disabled={isPending} />
      </div>

      <Field
        label="Email *"
        name="email"
        type="email"
        placeholder="juan@email.com"
        required
        disabled={isPending}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Teléfono"
          name="phone"
          type="tel"
          placeholder="+54 9 11 1234-5678"
          disabled={isPending}
        />
        <Field
          label="Fecha de nacimiento"
          name="birthDate"
          type="date"
          disabled={isPending}
        />
      </div>

      {error && (
        <div className="rounded-xl bg-[#ff0000]/8 border border-[#ff0000]/20 px-4 py-3 text-sm text-[#cc0000] font-medium">
          {error}
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
        <Link
          href={`/gym/${gymSlug}/members`}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-zinc-600 hover:text-black border border-zinc-200 hover:border-zinc-300 transition-all"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  required,
  disabled,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1fad9d] focus:border-transparent disabled:opacity-50 transition-all"
      />
    </div>
  )
}
