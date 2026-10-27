'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { updateGymAction, deleteGymAction, updateGymOwnerAction } from '../actions'
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
import { cn } from '@/lib/utils'
import { Switch, btn, field, initials } from '@/components/admin/ui'
import { PhoneInput } from '@/components/shared/PhoneInput'

const MAX_SIZE = 2 * 1024 * 1024

interface Props {
  gymId: string
  defaultName: string
  defaultSlug: string
  defaultPlan: string
  planOptions: { key: string; label: string }[]
  defaultLogoUrl?: string | null
  defaultAdvancedReports: boolean
  defaultWhatsapp: string | null
  defaultCountry: string | null
  ownerName?: string
  ownerEmail?: string
  hasOwner: boolean
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-adm-line-soft py-2.5 text-sm last:border-b-0">
      <dt className="text-adm-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold">{children}</dd>
    </div>
  )
}

export function GymEditForm({ gymId, defaultName, defaultSlug, defaultPlan, planOptions, defaultLogoUrl, defaultAdvancedReports, defaultWhatsapp, defaultCountry, ownerName, ownerEmail, hasOwner }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
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
      else if (data.logoUrl) { setLogoUrl(data.logoUrl); router.refresh() }
    })
    e.target.value = ''
  }

  const [name, setName] = useState(defaultName)
  const [slug, setSlug] = useState(defaultSlug)
  const [plan, setPlan] = useState(defaultPlan)
  const [advancedReports, setAdvancedReports] = useState(defaultAdvancedReports)
  const [whatsapp, setWhatsapp] = useState(defaultWhatsapp ? `+${defaultWhatsapp}` : '')
  const [newOwnerName, setNewOwnerName] = useState(ownerName ?? '')
  const [newOwnerEmail, setNewOwnerEmail] = useState(ownerEmail ?? '')
  const [newOwnerPassword, setNewOwnerPassword] = useState('')

  const plans = planOptions.length > 0 ? planOptions : [{ key: defaultPlan, label: defaultPlan }]
  const planLabel = (key: string) => plans.find(p => p.key.toUpperCase() === key?.toUpperCase())?.label ?? key

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) { setError('Nombre y slug requeridos'); return }
    setError(null)
    startTransition(async () => {
      const gymRes = await updateGymAction(gymId, {
        name, slug, subscriptionPlan: plan || undefined, advancedReportsEnabled: advancedReports,
        ...(whatsapp !== (defaultWhatsapp ? `+${defaultWhatsapp}` : '') && { whatsappPhone: whatsapp.trim() || null }),
      })
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
      // The detail URL is the slug, so a renamed gym moves to its new address
      if (slug !== defaultSlug) router.replace(`/admin/gyms/${slug}`)
    })
  }

  if (!open) {
    return (
      <section aria-labelledby="data-h" className="rounded-2xl border border-adm-line bg-adm-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="data-h" className="text-[15px] font-bold">Datos del gimnasio</h2>
          <button type="button" onClick={() => setOpen(true)} className={btn.line}>Editar</button>
        </div>
        <dl className="mt-3">
          <Info label="Nombre">{defaultName}</Info>
          <Info label="Slug"><span className="font-admin-mono">/{defaultSlug}</span></Info>
          <Info label="Plan">{planLabel(defaultPlan)}</Info>
          <Info label="Reportes avanzados">{defaultAdvancedReports ? 'Activos' : 'Inactivos'}</Info>
          <Info label="WhatsApp">{defaultWhatsapp ? <span className="font-admin-mono">+{defaultWhatsapp}</span> : '—'}</Info>
        </dl>
        <h3 className="mt-5 text-[13px] font-bold">Dueño</h3>
        {hasOwner ? (
          <div className="mt-2.5 flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-adm-ink text-[13px] font-extrabold text-adm-surface">
              {initials(ownerName ?? '?')}
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold">{ownerName}</p>
              <p className="truncate text-[13px] text-adm-muted">{ownerEmail}</p>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-adm-muted">Sin dueño asignado</p>
        )}
      </section>
    )
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5 rounded-2xl border-2 border-adm-ink bg-adm-surface p-5">
      <h2 className="text-[15px] font-bold">Editar gimnasio</h2>

      <div>
        <span className={field.label}>Logo</span>
        <div className="flex items-center gap-4">
          <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-adm-night/15 bg-adm-brand text-sm font-black text-adm-night">
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="Logo actual" className="size-full object-cover" />
              : initials(name || 'G')}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-bold text-white">…</div>
            )}
          </div>
          <div>
            <button type="button" disabled={isUploading} onClick={() => fileRef.current?.click()} className={btn.line}>
              <Camera className="size-3.5" aria-hidden="true" />
              {isUploading ? 'Subiendo…' : 'Cambiar logo'}
            </button>
            <p className={field.hint}>PNG, JPG, WebP, TIFF… · Máx. 2MB</p>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {uploadError && <p className={field.error}>{uploadError}</p>}
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="min-w-0 flex-1 basis-40">
          <span className={field.label}>Nombre</span>
          <input value={name} onChange={e => setName(e.target.value)} disabled={isPending} className={field.input} {...createHandlers('text')} />
        </label>
        <label className="min-w-0 flex-1 basis-40">
          <span className={field.label}>Slug</span>
          <input value={slug} onChange={e => setSlug(e.target.value)} disabled={isPending} className={cn(field.input, 'font-admin-mono')} {...createHandlers('slug')} />
        </label>
      </div>

      <div>
        <label htmlFor="edit-whatsapp" className={field.label}>WhatsApp del dueño</label>
        <PhoneInput
          id="edit-whatsapp"
          defaultValue={defaultWhatsapp}
          defaultCountry={defaultCountry}
          onChange={setWhatsapp}
          disabled={isPending}
          selectClassName={field.input}
          inputClassName={field.input}
        />
        <span className={field.hint}>Elegí el país y escribí el número. Recibe los avisos de límite del plan.</span>
      </div>

      <div>
        <span className={field.label} id="edit-plan-label">Plan</span>
        <div role="radiogroup" aria-labelledby="edit-plan-label" className="flex flex-wrap gap-2">
          {plans.map(p => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={plan === p.key}
              onClick={() => setPlan(p.key)}
              className={cn(
                'min-h-10 flex-1 rounded-lg border px-3 text-[13px] font-bold transition-colors',
                plan === p.key ? 'border-adm-ink bg-adm-ink text-adm-surface' : 'border-adm-line hover:border-adm-ink',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className={field.hint}>Para cobrar la diferencia usá “Cambiar plan” en Suscripción.</p>
      </div>

      <div className="flex items-center gap-3 rounded-[10px] border border-adm-line-soft px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Reportes avanzados</p>
          <p className="text-xs text-adm-muted">Tendencias, comparativas y análisis de retención</p>
        </div>
        <Switch checked={advancedReports} onChange={setAdvancedReports} disabled={isPending} label="Reportes avanzados" />
      </div>

      {hasOwner && (
        <div className="flex flex-col gap-4 border-t border-adm-line-soft pt-4">
          <p className="text-[13px] font-bold">Datos del dueño</p>
          <div className="flex flex-wrap gap-4">
            <label className="min-w-0 flex-1 basis-40">
              <span className={field.label}>Nombre</span>
              <input value={newOwnerName} onChange={e => setNewOwnerName(e.target.value)} disabled={isPending} className={field.input} {...createHandlers('name')} />
            </label>
            <label className="min-w-0 flex-1 basis-40">
              <span className={field.label}>Email</span>
              <input type="email" value={newOwnerEmail} onChange={e => setNewOwnerEmail(e.target.value)} disabled={isPending} className={field.input} {...createHandlers('email')} />
            </label>
          </div>
          <label className="block">
            <span className={field.label}>Nueva contraseña</span>
            <input type="password" value={newOwnerPassword} onChange={e => setNewOwnerPassword(e.target.value)} disabled={isPending} placeholder="Dejar vacío para no cambiar" className={field.input} {...createHandlers('password')} />
          </label>
        </div>
      )}

      {error && <p role="alert" className={field.error}>{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className={cn(btn.dark, 'min-h-11 flex-1')}>
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={cn(btn.line, 'min-h-11')}>Cancelar</button>
      </div>
    </form>
  )
}

export function GymDangerZone({ gymId }: { gymId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteGymAction(gymId)
      if (res?.error) { setError(res.error); setOpen(false) }
      else { router.push('/admin/gyms') }
    })
  }

  return (
    <section aria-labelledby="dz-h" className="rounded-2xl border border-adm-bad-line bg-adm-surface p-5">
      <h2 id="dz-h" className="text-[15px] font-bold text-adm-bad-fg">Zona de peligro</h2>
      <p className="mb-4 mt-2 text-[13px] leading-relaxed text-adm-muted">
        Eliminar borra miembros, pagos y la tienda del gimnasio. No se puede deshacer.
      </p>
      {error && <p role="alert" className={cn(field.error, 'mb-3')}>{error}</p>}
      <button type="button" onClick={() => setOpen(true)} className={btn.danger}>Eliminar gimnasio</button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="sm" className="admin-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar gimnasio?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción es permanente y no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <button type="button" disabled={isPending} onClick={handleDelete} className={btn.dangerSolid}>
              {isPending ? 'Eliminando…' : 'Eliminar'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
