'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Pencil, X, Trash2, BarChart2 } from 'lucide-react'
import { updateGymAction, deleteGymAction, updateGymOwnerAction, uploadGymLogoAction } from '../actions'
import { createHandlers } from '@/lib/input-validation'
import { Switch } from '@/components/ui/switch'
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

const PLANS = ['BASIC', 'PRO', 'ENTERPRISE']

const inputClass = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all disabled:opacity-50'

const MAX_SIZE = 2 * 1024 * 1024

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

interface Props {
  gymId: string
  defaultName: string
  defaultSlug: string
  defaultPlan: string
  defaultLogoUrl?: string | null
  defaultAdvancedReports: boolean
  ownerName?: string
  ownerEmail?: string
  hasOwner: boolean
}

export function GymEditForm({ gymId, defaultName, defaultSlug, defaultPlan, defaultLogoUrl, defaultAdvancedReports, ownerName, ownerEmail, hasOwner }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState(defaultLogoUrl ?? '')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, startUploadTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    if (!file.type.startsWith('image/')) {
      setUploadError('Solo se permiten archivos de imagen')
      return
    }
    if (file.size > MAX_SIZE) {
      setUploadError('El archivo supera 2MB')
      return
    }
    const fd = new FormData()
    fd.append('logo', file)
    startUploadTransition(async () => {
      const res = await fetch(`/api/v1/gyms/${gymId}/logo`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({})) as { error?: string; logoUrl?: string }
      if (!res.ok || data.error) { setUploadError(data.error ?? 'Error al subir el logo') }
      else if (data.logoUrl) { setLogoUrl(data.logoUrl) }
    })
    e.target.value = ''
  }

  const [name, setName] = useState(defaultName)
  const [slug, setSlug] = useState(defaultSlug)
  const [plan, setPlan] = useState(defaultPlan)
  const [advancedReports, setAdvancedReports] = useState(defaultAdvancedReports)
  const [newOwnerName, setNewOwnerName] = useState(ownerName ?? '')
  const [newOwnerEmail, setNewOwnerEmail] = useState(ownerEmail ?? '')
  const [newOwnerPassword, setNewOwnerPassword] = useState('')

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) { setError('Nombre y slug requeridos'); return }
    setError(null)
    startTransition(async () => {
      const gymRes = await updateGymAction(gymId, { name, slug, subscriptionPlan: plan || undefined, advancedReportsEnabled: advancedReports })
      if (gymRes?.error) { setError(gymRes.error); return }

      if (hasOwner && (newOwnerName !== ownerName || newOwnerEmail !== ownerEmail || newOwnerPassword)) {
        const ownerUpdate: { name?: string; email?: string; password?: string } = {}
        if (newOwnerName !== ownerName) ownerUpdate.name = newOwnerName
        if (newOwnerEmail !== ownerEmail) ownerUpdate.email = newOwnerEmail
        if (newOwnerPassword) ownerUpdate.password = newOwnerPassword

        if (Object.keys(ownerUpdate).length > 0) {
          const ownerRes = await updateGymOwnerAction(gymId, ownerUpdate)
          if (ownerRes?.error) { setError(ownerRes.error); return }
        }
      }

      setOpen(false)
      setNewOwnerPassword('')
      router.refresh()
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteGymAction(gymId)
      if (res?.error) { setError(res.error) }
      else { router.push('/admin/gyms') }
    })
  }

  if (!open) {
    return (
      <>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
          >
            <Pencil className="h-4 w-4" />
            Editar gimnasio
          </button>

          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-[#ff0000] hover:border-[#ff0000]/30 transition-all"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </button>
        </div>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar gimnasio?</AlertDialogTitle>
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

  return (
    <form onSubmit={handleSave} className="rounded-2xl border-2 border-zinc-200 bg-white p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">Editar gimnasio</h3>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar formulario" className="text-zinc-400 hover:text-zinc-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Logo upload */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Logo</p>
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14 rounded-xl bg-[#fffb00] flex items-center justify-center shrink-0 overflow-hidden">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
              : <span className="text-sm font-black text-black">{initials(name || 'G')}</span>
            }
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                <span className="text-white text-xs font-bold">…</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:border-zinc-300 transition-all disabled:opacity-50"
            >
              <Camera className="h-3.5 w-3.5" />
              {isUploading ? 'Subiendo…' : 'Cambiar logo'}
            </button>
            <p className="text-xs text-zinc-400">PNG, JPG, WebP, TIFF… · Máx. 2MB</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploadError && <p className="text-xs text-[#ff0000] font-medium">{uploadError}</p>}
      </div>

      {/* Gym fields */}
      <div className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Información del gimnasio</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} disabled={isPending} className={inputClass} {...createHandlers('text')} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500">Slug</label>
            <input value={slug} onChange={e => setSlug(e.target.value)} disabled={isPending} className={inputClass} {...createHandlers('slug')} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-500">Plan</label>
          <div className="flex gap-2">
            {PLANS.map(p => (
              <button key={p} type="button" onClick={() => setPlan(p)}
                className={`flex-1 rounded-xl py-2 text-xs font-bold border-2 transition-all ${plan === p ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3 pt-2 border-t border-zinc-100">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Funcionalidades</p>
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${advancedReports ? 'border-violet-200 bg-violet-50' : 'border-zinc-200 bg-zinc-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${advancedReports ? 'bg-violet-100' : 'bg-zinc-100'}`}>
              <BarChart2 className={`h-3.5 w-3.5 ${advancedReports ? 'text-violet-600' : 'text-zinc-400'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-700">Reportes Avanzados</p>
              <p className="text-xs text-zinc-400">Tendencias, comparativas y análisis de retención</p>
            </div>
          </div>
          <Switch checked={advancedReports} onCheckedChange={setAdvancedReports} disabled={isPending} />
        </div>
      </div>

      {/* Owner fields */}
      {hasOwner && (
        <div className="space-y-4 pt-2 border-t border-zinc-100">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Datos del dueño</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500">Nombre</label>
              <input value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)} disabled={isPending} className={inputClass} {...createHandlers('name')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500">Email</label>
              <input type="email" value={newOwnerEmail} onChange={e => setNewOwnerEmail(e.target.value)} disabled={isPending} className={inputClass} {...createHandlers('email')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500">Nueva contraseña (dejar vacío para no cambiar)</label>
            <input type="password" value={newOwnerPassword} onChange={e => setNewOwnerPassword(e.target.value)} disabled={isPending} placeholder="••••••••" className={inputClass} {...createHandlers('password')} />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-[#ff0000] font-medium">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-black py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all">
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all">
          Cancelar
        </button>
      </div>
    </form>
  )
}
