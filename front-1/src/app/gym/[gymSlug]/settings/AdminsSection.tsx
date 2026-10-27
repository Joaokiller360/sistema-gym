'use client'

import { useState, useTransition } from 'react'
import { Copy, Check } from 'lucide-react'
import { createGymAdminAction, deleteGymAdminAction, type GymAdmin } from './actions'
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
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/client'
import { commonMessages } from '@/i18n/common'
import { settingsMessages } from './messages'

const inputClass = 'h-12 w-full rounded-xl border border-adm-line bg-adm-ground px-3.5 text-[15px] text-adm-ink outline-none transition-colors placeholder:text-adm-muted focus:border-adm-ink dark:focus:border-adm-brand disabled:opacity-50'
const labelClass = 'mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-adm-muted'

function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const tc = useT(commonMessages)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" onClick={handleCopy} aria-label={copied ? tc.copied : label} className={className ?? 'text-zinc-400 transition-colors hover:text-black'}>
      {copied ? <Check className="h-3.5 w-3.5 text-[#1fad9d]" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function DeleteAdminButton({ gymSlug, admin, onDeleted }: { gymSlug: string; admin: GymAdmin; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const t = useT(settingsMessages).admins
  const tc = useT(commonMessages)

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteGymAdminAction(gymSlug, admin.id)
      if (res.error) { setError(res.error) }
      else { setOpen(false); onDeleted() }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.removeAccess(admin.name)}
        className="h-10 rounded-[10px] px-3 text-[13px] font-bold text-adm-bad-fg transition-colors hover:bg-adm-bad-bg"
      >
        {t.remove}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteBody(admin.name, admin.email)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-xs text-[#ff0000] font-medium px-1">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>{tc.cancel}</AlertDialogCancel>
            <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
              {isPending ? '…' : tc.delete}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function AdminsSection({ gymSlug, initialAdmins }: { gymSlug: string; initialAdmins: GymAdmin[] }) {
  const [admins, setAdmins] = useState(initialAdmins)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [newCreds, setNewCreds] = useState<{ name: string; email: string; password: string; emailSent: boolean } | null>(null)
  const t = useT(settingsMessages).admins

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await createGymAdminAction(gymSlug, name.trim(), email.trim())
      if (res.error) {
        setError(res.error)
      } else {
        setNewCreds({ name: name.trim(), email: email.trim(), password: res.tempPassword ?? '', emailSent: res.emailSent ?? false })
        setName('')
        setEmail('')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Credentials modal */}
      <AlertDialog open={!!newCreds} onOpenChange={() => setNewCreds(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.createdTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.createdBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-500">{t.email}</span>
              <div className="flex items-center gap-2 font-medium">{newCreds?.email} <CopyButton text={newCreds?.email ?? ''} label={t.copyEmail} /></div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-500">{t.password}</span>
              <div className="flex items-center gap-2 font-mono font-bold">{newCreds?.password} <CopyButton text={newCreds?.password ?? ''} label={t.copyPassword} /></div>
            </div>
          </div>
          <p className={`rounded-xl px-3.5 py-2.5 text-[13px] font-semibold ${newCreds?.emailSent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
            {newCreds?.emailSent ? t.emailSent(newCreds.email) : t.emailFailed}
          </p>
          <AlertDialogFooter>
            <Button onClick={() => setNewCreds(null)}>{t.gotIt}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section aria-labelledby="admins-h" className="overflow-hidden rounded-[20px] border border-adm-line bg-adm-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-adm-line p-[22px]">
          <div className="flex flex-col gap-1">
            <h2 id="admins-h" className="text-[17px] font-extrabold">{t.title}</h2>
            <p className="text-[13px] text-adm-muted">{t.subtitle}</p>
          </div>
          <span className="font-admin-mono text-[13px] text-adm-muted">
            {t.count(admins.length)}
          </span>
        </div>

        {admins.length === 0 ? (
          <p className="border-b border-adm-line px-[22px] py-6 text-sm text-adm-muted">{t.empty}</p>
        ) : (
          <ul>
            {admins.map(admin => {
              const initials = admin.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
              return (
                <li key={admin.id} className="flex flex-wrap items-center gap-3.5 border-b border-adm-line px-[22px] py-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-adm-line text-sm font-black">
                    {initials || '?'}
                  </span>
                  <span className="flex min-w-[180px] flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-extrabold">{admin.name}</span>
                    <span className="truncate font-admin-mono text-xs text-adm-muted">{admin.email}</span>
                  </span>
                  {!admin.isActive && (
                    <span className="inline-flex h-7 items-center rounded-full bg-adm-chip px-2.5 text-xs font-extrabold text-adm-muted">{t.inactive}</span>
                  )}
                  <CopyButton
                    text={admin.email}
                    label={t.copyEmailOf(admin.name)}
                    className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-adm-line text-adm-muted transition-colors hover:text-adm-ink"
                  />
                  <DeleteAdminButton gymSlug={gymSlug} admin={admin} onDeleted={() => { setAdmins(a => a.filter(x => x.id !== admin.id)) }} />
                </li>
              )
            })}
          </ul>
        )}

        <form onSubmit={handleCreate} aria-labelledby="invite-h" className="flex flex-col gap-3.5 bg-adm-subtle p-[22px]">
          <h3 id="invite-h" className="text-sm font-extrabold">{t.invite}</h3>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div>
              <label htmlFor="admin-name" className={labelClass}>{t.name}</label>
              <input id="admin-name" value={name} onChange={e => setName(e.target.value)} required disabled={isPending} placeholder={t.namePlaceholder} className={inputClass} {...createHandlers('name')} />
            </div>
            <div>
              <label htmlFor="admin-email" className={labelClass}>{t.email}</label>
              <input id="admin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isPending} placeholder={t.emailPlaceholder} className={inputClass} {...createHandlers('email')} />
            </div>
            <button
              type="submit"
              disabled={isPending || !name.trim() || !email.trim()}
              className="h-12 rounded-xl bg-adm-brand px-[18px] text-sm font-black text-adm-night transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? t.sending : t.send}
            </button>
          </div>
          {error && <p role="alert" className="text-xs font-medium text-adm-bad-fg">{error}</p>}
          <p className="text-[13px] text-adm-muted">{t.inviteHint}</p>
        </form>
      </section>
    </div>
  )
}
