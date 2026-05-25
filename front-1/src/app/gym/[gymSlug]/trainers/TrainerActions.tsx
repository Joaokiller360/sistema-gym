'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { createTrainerAction, deleteTrainerAction } from './actions'
import { createHandlers } from '@/lib/input-validation'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  gymSlug: string
}

export function TrainerCreateButton({ gymSlug }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialty: '',
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await createTrainerAction(gymSlug, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        specialty: form.specialty || undefined,
      })
      if (res.error) {
        setError(res.error)
      } else {
        setOpen(false)
        setForm({ firstName: '', lastName: '', email: '', phone: '', specialty: '' })
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-all"
      >
        <Plus className="h-4 w-4" />
        Agregar entrenador
      </button>

      <Dialog open={open} onOpenChange={o => { if (!o) { setOpen(false); setError(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo entrenador</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                ['firstName', 'Nombre', true],
                ['lastName', 'Apellido', true],
                ['email', 'Email', true],
                ['phone', 'Teléfono', false],
                ['specialty', 'Especialidad', false],
              ] as [keyof typeof form, string, boolean][]).map(([field, label, required]) => (
                <div key={field} className={field === 'email' ? 'sm:col-span-2' : ''}>
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 block mb-1">{label}</label>
                  <input
                    type={field === 'email' ? 'email' : 'text'}
                    value={form[field]}
                    onChange={set(field)}
                    required={required}
                    disabled={isPending}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                    {...createHandlers(
                      field === 'email' ? 'email' :
                      field === 'phone' ? 'phone' :
                      (field === 'firstName' || field === 'lastName') ? 'name' : 'text'
                    )}
                  />
                </div>
              ))}
            </div>

            {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-xl bg-black py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all"
              >
                {isPending ? 'Guardando…' : 'Crear entrenador'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null) }}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function DeleteTrainerButton({ gymSlug, trainerId }: { gymSlug: string; trainerId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleDelete() {
    startTransition(async () => {
      await deleteTrainerAction(gymSlug, trainerId)
      setDeleteOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:border-[#ff0000]/30 hover:text-[#ff0000] transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entrenador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
              {isPending ? '…' : 'Eliminar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
