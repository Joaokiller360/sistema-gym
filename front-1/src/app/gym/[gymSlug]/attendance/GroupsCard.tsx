'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { AttendanceGroup } from '@/types'
import { createGroupAction, deleteGroupAction } from './actions'
import { groupColor } from './groupColors'

interface Props {
  gymSlug: string
  groups: AttendanceGroup[]
  counts: Record<string, number>
  isToday: boolean
}

export function GroupsCard({ gymSlug, groups, counts, isToday }: Props) {
  const router = useRouter()
  const [newGroupName, setNewGroupName] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleNameChange(val: string) {
    const letters = val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
    setNewGroupName(letters.length > 0 ? letters.charAt(0).toUpperCase() + letters.slice(1) : '')
    setNameError(null)
  }

  function openModal() { setNewGroupName(''); setNameError(null); setShowModal(true) }
  function closeModal() { setShowModal(false) }

  function handleCreate() {
    if (!newGroupName.trim()) { setNameError('Nombre requerido'); return }
    startTransition(async () => {
      const res = await createGroupAction(gymSlug, newGroupName)
      if (res.error) setNameError(res.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleDelete(groupId: string) {
    setError(null)
    startTransition(async () => {
      const res = await deleteGroupAction(gymSlug, groupId)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <section aria-labelledby="grupos-h" className="flex flex-col gap-3.5 rounded-[20px] border border-adm-line bg-adm-surface px-6 py-5">
      <div className="flex items-center justify-between">
        <h2 id="grupos-h" className="text-[15px] font-extrabold">Turnos del gimnasio</h2>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-adm-line bg-adm-surface px-3 text-[13px] font-bold transition-colors hover:bg-adm-chip"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Nuevo
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-[13px] text-adm-muted">Sin turnos aún. Creá uno para organizar la asistencia.</p>
      ) : (
        <ul className="flex flex-col">
          {groups.map((g, i) => (
            <li key={g.id} className="flex items-center gap-2.5 border-t border-adm-line-soft py-2.5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${groupColor(i).dot}`} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.name}</span>
              <span className="text-[13px] text-adm-muted">{counts[g.id] ?? 0}{isToday ? ' hoy' : ''}</span>
              <button
                type="button"
                aria-label={`Eliminar turno ${g.name}`}
                onClick={() => handleDelete(g.id)}
                disabled={isPending}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-adm-muted transition-colors hover:bg-adm-bad-bg hover:text-adm-bad-fg disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p role="alert" className="text-[13px] font-medium text-adm-bad-fg">{error}</p>}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div role="dialog" aria-modal="true" aria-labelledby="new-group-h" className="admin-surface relative w-full max-w-sm space-y-5 rounded-2xl bg-adm-surface p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 id="new-group-h" className="text-base font-bold">Nuevo turno</h3>
              <button type="button" aria-label="Cerrar" onClick={closeModal} className="text-adm-muted transition-colors hover:text-adm-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-group-name" className="text-xs font-bold uppercase tracking-[0.08em] text-adm-muted">Nombre</label>
              <input
                id="new-group-name"
                autoFocus
                value={newGroupName}
                onChange={e => handleNameChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') closeModal() }}
                placeholder="Ej. Mañana"
                maxLength={50}
                className="h-11 w-full rounded-xl border border-adm-line bg-adm-subtle px-4 text-sm outline-none transition-colors focus:border-[#1fad9d]"
              />
              {nameError && <p className="text-xs font-medium text-adm-bad-fg">{nameError}</p>}
              <p className="text-xs text-adm-muted">Solo letras. Primera letra en mayúscula automática.</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCreate}
                disabled={isPending || !newGroupName.trim()}
                className="h-11 flex-1 rounded-xl bg-[#0e7a70] text-sm font-bold text-white transition-colors hover:bg-[#095a52] disabled:opacity-50"
              >
                {isPending ? 'Creando…' : 'Crear turno'}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="h-11 rounded-xl border border-adm-line px-4 text-sm font-semibold text-adm-muted transition-colors hover:text-adm-ink"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
