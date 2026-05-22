'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog'
import { updateMemberAction } from './actions'
import { Member } from '@/types'

interface Props {
  gymSlug: string
  member: Member
}

const LETTERS_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

interface FieldErrors {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
}

function validateFields(data: { firstName: string; lastName: string; email: string; phone: string }): FieldErrors {
  const errors: FieldErrors = {}
  if (!data.firstName.trim()) errors.firstName = 'El nombre es obligatorio'
  else if (!LETTERS_REGEX.test(data.firstName.trim())) errors.firstName = 'Solo puede contener letras'
  if (!data.lastName.trim()) errors.lastName = 'El apellido es obligatorio'
  else if (!LETTERS_REGEX.test(data.lastName.trim())) errors.lastName = 'Solo puede contener letras'
  if (!data.email.trim()) errors.email = 'El email es obligatorio'
  else if (!EMAIL_REGEX.test(data.email.trim())) errors.email = 'Email inválido'
  if (data.phone && !/^\d+$/.test(data.phone)) errors.phone = 'El teléfono solo puede contener números'
  else if (data.phone && data.phone.length < 7) errors.phone = 'Mínimo 7 dígitos'
  return errors
}

export function EditMemberModal({ gymSlug, member }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  const birthDateDefault = member.birthDate
    ? new Date(member.birthDate).toISOString().split('T')[0]
    : ''

  function close() {
    setIsOpen(false)
    setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('edit')
      const str = params.toString()
      router.push(str ? `?${str}` : '?')
    }, 120)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
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
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})

    startTransition(async () => {
      const result = await updateMemberAction(gymSlug, member.id, data)
      if (result.error) { setServerError(result.error); return }
      toast.success('Miembro actualizado correctamente')
      setIsOpen(false)
      setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('edit')
        const str = params.toString()
        router.push(str ? `?${str}` : '?')
        router.refresh()
      }, 120)
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) close() }}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Editar miembro</DialogTitle>
          <DialogDescription>Modificá los datos del miembro.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LetterField label="Nombre *" name="firstName" defaultValue={member.firstName} disabled={isPending} error={fieldErrors.firstName} onChange={() => setFieldErrors(p => ({ ...p, firstName: undefined }))} />
            <LetterField label="Apellido *" name="lastName" defaultValue={member.lastName} disabled={isPending} error={fieldErrors.lastName} onChange={() => setFieldErrors(p => ({ ...p, lastName: undefined }))} />
          </div>

          <Field label="Email *" name="email" type="email" defaultValue={member.email} disabled={isPending} error={fieldErrors.email} onChange={() => setFieldErrors(p => ({ ...p, email: undefined }))} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PhoneField label="Teléfono" name="phone" defaultValue={member.phone ?? ''} disabled={isPending} error={fieldErrors.phone} onChange={() => setFieldErrors(p => ({ ...p, phone: undefined }))} />
            <Field label="Fecha de nacimiento" name="birthDate" type="date" defaultValue={birthDateDefault} disabled={isPending} />
          </div>

          {serverError && (
            <div className="rounded-xl bg-[#ff0000]/8 border border-[#ff0000]/20 px-4 py-3 text-sm text-[#cc0000] font-medium">
              {serverError}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-black px-6 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={isPending}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold text-zinc-600 hover:text-black border border-zinc-200 hover:border-zinc-300 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, name, type = 'text', defaultValue, disabled, error, onChange }: {
  label: string; name: string; type?: string; defaultValue?: string; disabled?: boolean; error?: string; onChange?: () => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <input
        name={name} type={type} defaultValue={defaultValue} disabled={disabled}
        onInput={onChange}
        className={`w-full rounded-xl border bg-zinc-50 px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 transition-all ${
          error ? 'border-[#ff0000]/60 focus:ring-[#ff0000]/30' : 'border-zinc-200 focus:ring-[#1fad9d]'
        }`}
      />
      {error && <p className="text-xs text-[#cc0000] font-medium">{error}</p>}
    </div>
  )
}

function LetterField({ label, name, defaultValue, disabled, error, onChange }: {
  label: string; name: string; defaultValue?: string; disabled?: boolean; error?: string; onChange?: () => void
}) {
  function handleInput(e: React.FormEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const filtered = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]/g, '')
    if (input.value !== filtered) input.value = filtered
    onChange?.()
  }
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <input
        name={name} type="text" defaultValue={defaultValue} disabled={disabled}
        onInput={handleInput}
        className={`w-full rounded-xl border bg-zinc-50 px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 transition-all ${
          error ? 'border-[#ff0000]/60 focus:ring-[#ff0000]/30' : 'border-zinc-200 focus:ring-[#1fad9d]'
        }`}
      />
      {error && <p className="text-xs text-[#cc0000] font-medium">{error}</p>}
    </div>
  )
}

function PhoneField({ label, name, defaultValue, disabled, error, onChange }: {
  label: string; name: string; defaultValue?: string; disabled?: boolean; error?: string; onChange?: () => void
}) {
  function handleInput(e: React.FormEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const filtered = input.value.replace(/\D/g, '').slice(0, 10)
    if (input.value !== filtered) input.value = filtered
    onChange?.()
  }
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <input
        name={name} type="text" inputMode="numeric" maxLength={10}
        defaultValue={defaultValue} disabled={disabled}
        placeholder="0986660737"
        onInput={handleInput}
        className={`w-full rounded-xl border bg-zinc-50 px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 transition-all ${
          error ? 'border-[#ff0000]/60 focus:ring-[#ff0000]/30' : 'border-zinc-200 focus:ring-[#1fad9d]'
        }`}
      />
      {error && <p className="text-xs text-[#cc0000] font-medium">{error}</p>}
    </div>
  )
}
