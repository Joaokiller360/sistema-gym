'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { loginAction } from './actions'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
})

type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null)
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-foreground">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          disabled={isPending}
          {...register('email')}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1fad9d] focus:border-transparent disabled:opacity-50 transition-all"
        />
        {errors.email && (
          <p className="text-xs text-[#ff0000] font-medium">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-semibold text-foreground">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={isPending}
          {...register('password')}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1fad9d] focus:border-transparent disabled:opacity-50 transition-all"
        />
        {errors.password && (
          <p className="text-xs text-[#ff0000] font-medium">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <div className="rounded-xl bg-[#ff0000]/8 border border-[#ff0000]/20 px-4 py-3 text-sm text-[#cc0000] font-medium">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-black py-3 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Ingresando…
          </>
        ) : (
          'Ingresar'
        )}
      </button>
    </form>
  )
}
