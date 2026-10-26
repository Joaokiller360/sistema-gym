'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { loginAction } from './actions'
import { createBlockHandlers } from '@/lib/input-validation'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
})

type FormValues = z.infer<typeof schema>

// Fixed colors: the card is white in both themes
const inputCls =
  'h-[52px] w-full rounded-[14px] border-[1.5px] border-[#D6D6D0] bg-[#F7F7F4] px-4 text-[15px] text-[#111111] placeholder:text-[#8A8A85] transition-shadow focus:border-[#111111] focus:outline-none focus:ring-[3px] focus:ring-[#FFFB00]/60 disabled:opacity-50 aria-[invalid=true]:border-[#C62828]'

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await loginAction(values)
      if (result?.error) setServerError(result.error)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-[13px] font-bold">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          disabled={isPending}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
          {...createBlockHandlers('email')}
          className={inputCls}
        />
        {errors.email && (
          <p id="email-error" className="text-xs font-semibold text-[#A61B1B]">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[13px] font-bold">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={isPending}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
            {...createBlockHandlers('password')}
            className={`${inputCls} pr-24`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            aria-pressed={showPassword}
            aria-controls="password"
            className="absolute right-1.5 top-1.5 h-10 rounded-[10px] px-3 text-[13px] font-bold text-[#3F3F3A] transition-colors hover:bg-[#ECECE6]"
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-xs font-semibold text-[#A61B1B]">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="rounded-xl border border-[#F5C2C2] bg-[#FDECEC] px-3.5 py-3 text-sm font-semibold text-[#A61B1B]">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-14 items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-[#0B0B0C] bg-[#FFFB00] text-base font-black tracking-[0.01em] text-[#0B0B0C] transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-70"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Ingresando…
          </>
        ) : (
          'Ingresar'
        )}
      </button>
    </form>
  )
}
