'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Copy, Check } from 'lucide-react'
import { createGymAdminAction, deleteGymAdminAction, type GymAdmin } from './actions'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" onClick={handleCopy} className="text-zinc-400 hover:text-black transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-[#1fad9d]" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function DeleteAdminButton({ admin, onDeleted }: { admin: GymAdmin; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteGymAdminAction(admin.id)
      if (res.error) { setError(res.error) }
      else { setOpen(false); onDeleted() }
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-400 hover:border-[#ff0000]/30 hover:text-[#ff0000] transition-colors">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              {admin.name} ({admin.email}) perderá acceso al panel. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-xs text-[#ff0000] font-medium px-1">{error}</p>}
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

export function AdminsSection({ initialAdmins }: { initialAdmins: GymAdmin[] }) {
  const router = useRouter()
  const [admins, setAdmins] = useState(initialAdmins)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newCreds, setNewCreds] = useState<{ name: string; email: string; password: string } | null>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await createGymAdminAction(name.trim(), email.trim())
      if (res.error) {
        setError(res.error)
      } else {
        setNewCreds({ name: name.trim(), email: email.trim(), password: res.tempPassword ?? '' })
        setName('')
        setEmail('')
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Credentials modal */}
      <AlertDialog open={!!newCreds} onOpenChange={() => setNewCreds(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Administrador creado</AlertDialogTitle>
            <AlertDialogDescription>
              Guardá estas credenciales antes de cerrar. La contraseña no se puede recuperar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-500">Email</span>
              <div className="flex items-center gap-2 font-medium">{newCreds?.email} <CopyButton text={newCreds?.email ?? ''} /></div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-500">Contraseña</span>
              <div className="flex items-center gap-2 font-mono font-bold">{newCreds?.password} <CopyButton text={newCreds?.password ?? ''} /></div>
            </div>
          </div>
          <AlertDialogFooter>
            <Button onClick={() => setNewCreds(null)}>Entendido</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* List */}
      {admins.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay administradores aún.</p>
      ) : (
        <div className="rounded-2xl border border-zinc-200 overflow-hidden">
          {admins.map((admin, i) => (
            <div key={admin.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-zinc-100' : ''}`}>
              <div>
                <p className="text-sm font-semibold">{admin.name}</p>
                <p className="text-xs text-zinc-400">{admin.email}</p>
              </div>
              <DeleteAdminButton admin={admin} onDeleted={() => { setAdmins(a => a.filter(x => x.id !== admin.id)) }} />
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {open ? (
        <form onSubmit={handleCreate} className="rounded-2xl border-2 border-zinc-200 bg-white p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Nuevo administrador</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} required disabled={isPending} placeholder="Juan García" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isPending} placeholder="juan@email.com" className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-zinc-400">Se generará una contraseña temporal automáticamente.</p>
          {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={isPending} className="rounded-xl bg-black px-5 py-2 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
              {isPending ? 'Creando…' : 'Crear administrador'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(null) }} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
        >
          <Plus className="h-4 w-4" />
          Agregar administrador
        </button>
      )}
    </div>
  )
}
