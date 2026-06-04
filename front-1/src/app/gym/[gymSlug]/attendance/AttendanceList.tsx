'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, X, Users } from 'lucide-react'
import { Attendance, AttendanceGroup } from '@/types'
import { deleteAttendanceAction, createGroupAction, deleteGroupAction } from './actions'

interface AttendanceWithMember extends Attendance {
  member?: { id: string; firstName: string; lastName: string } | null
}

interface Props {
  gymSlug: string
  records: AttendanceWithMember[]
  groups: AttendanceGroup[]
  isToday: boolean
}

const GROUP_COLORS = [
  { dot: 'bg-violet-400', badge: 'bg-violet-100 text-violet-700', del: 'hover:text-violet-900' },
  { dot: 'bg-sky-400',    badge: 'bg-sky-100 text-sky-700',       del: 'hover:text-sky-900'    },
  { dot: 'bg-emerald-400',badge: 'bg-emerald-100 text-emerald-700',del: 'hover:text-emerald-900'},
  { dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',   del: 'hover:text-amber-900'  },
  { dot: 'bg-rose-400',   badge: 'bg-rose-100 text-rose-700',     del: 'hover:text-rose-900'   },
]

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const letters = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
  return (
    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#1fad9d]/20 to-[#1fad9d]/50 flex items-center justify-center shrink-0">
      <span className="text-[11px] font-black text-[#0e7a70] select-none">{letters || '?'}</span>
    </div>
  )
}

function SectionHeader({ title, count, colorIdx }: { title: string; count: number; colorIdx?: number }) {
  const color = colorIdx !== undefined ? GROUP_COLORS[colorIdx % GROUP_COLORS.length] : null
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className={`h-2 w-2 rounded-full ${color?.dot ?? 'bg-zinc-300'}`} />
      <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{title}</p>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color?.badge ?? 'bg-zinc-100 text-zinc-500'}`}>{count}</span>
    </div>
  )
}

function RecordRow({
  record,
  onDelete,
  deletingId,
}: {
  record: AttendanceWithMember
  onDelete: (id: string) => void
  deletingId: string | null
}) {
  const name = record.member
    ? `${record.member.firstName} ${record.member.lastName}`
    : record.memberId.slice(0, 8) + '…'

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 group transition-colors">
      <Avatar name={name} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-800 truncate">{name}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{fmt(record.checkIn)}</p>
      </div>
      <button
        type="button"
        onClick={() => onDelete(record.id)}
        disabled={deletingId === record.id}
        className="p-1.5 rounded-lg text-transparent group-hover:text-zinc-300 hover:!text-red-500 hover:bg-red-50 disabled:opacity-40 transition-all"
        title="Eliminar registro"
      >
        {deletingId === record.id
          ? <span className="text-[10px] text-zinc-400">…</span>
          : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

function GroupSection({
  title,
  records,
  colorIdx,
  onDelete,
  deletingId,
}: {
  title: string
  records: AttendanceWithMember[]
  colorIdx?: number
  onDelete: (id: string) => void
  deletingId: string | null
}) {
  if (records.length === 0) return null
  return (
    <div>
      <SectionHeader title={title} count={records.length} colorIdx={colorIdx} />
      <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white divide-y divide-zinc-100">
        {records.map(a => (
          <RecordRow key={a.id} record={a} onDelete={onDelete} deletingId={deletingId} />
        ))}
      </div>
    </div>
  )
}

export function AttendanceList({ gymSlug, records, groups, isToday }: Props) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupNameError, setGroupNameError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleGroupNameChange(val: string) {
    const letters = val.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
    const capitalized = letters.length > 0 ? letters.charAt(0).toUpperCase() + letters.slice(1) : ''
    setNewGroupName(capitalized)
    setGroupNameError(null)
  }

  function openModal() { setNewGroupName(''); setGroupNameError(null); setShowGroupModal(true) }
  function closeModal() { setShowGroupModal(false) }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      const res = await deleteAttendanceAction(gymSlug, id)
      setDeletingId(null)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  function handleCreateGroup() {
    if (!newGroupName.trim()) { setGroupNameError('Nombre requerido'); return }
    startTransition(async () => {
      const res = await createGroupAction(gymSlug, newGroupName)
      if (res.error) setGroupNameError(res.error)
      else { closeModal(); router.refresh() }
    })
  }

  function handleDeleteGroup(groupId: string) {
    startTransition(async () => {
      const res = await deleteGroupAction(gymSlug, groupId)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  const grouped = groups.map((g, i) => ({
    group: g,
    colorIdx: i,
    records: records.filter(a => a.groupId === g.id),
  }))
  const ungrouped = records.filter(a => !a.groupId)

  return (
    <div className="space-y-5">
      {/* Group management card */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Grupos</p>
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500 hover:bg-[#1fad9d]/10 hover:text-[#1fad9d] transition-colors"
          >
            <Plus className="h-3 w-3" />
            Nuevo grupo
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="text-xs text-zinc-400">Sin grupos aún. Crea uno para organizar la asistencia por turno.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map((g, i) => {
              const color = GROUP_COLORS[i % GROUP_COLORS.length]
              const count = records.filter(a => a.groupId === g.id).length
              return (
                <span key={g.id} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${color.badge}`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
                  {g.name}
                  <span className="opacity-50 text-[10px] font-bold">{count}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(g.id)}
                    disabled={isPending}
                    className={`opacity-40 hover:opacity-100 ${color.del} disabled:opacity-20 transition-opacity ml-0.5`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      {/* Records */}
      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-16 gap-3">
          <div className="h-12 w-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
            <Users className="h-5 w-5 text-zinc-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-400">Sin registros</p>
            <p className="text-xs text-zinc-300 mt-0.5">No hay asistencia registrada para este día</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ group, colorIdx, records: gr }) => (
            <GroupSection
              key={group.id}
              title={group.name}
              records={gr}
              colorIdx={colorIdx}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          ))}
          {ungrouped.length > 0 && (
            <GroupSection
              title={groups.length > 0 ? 'Sin grupo' : isToday ? 'Todos los registros' : 'Registros del día'}
              records={ungrouped}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          )}
        </div>
      )}

      {/* Create group modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Nuevo grupo</h3>
              <button type="button" onClick={closeModal} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nombre del grupo</label>
              <input
                autoFocus
                value={newGroupName}
                onChange={e => handleGroupNameChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') closeModal() }}
                placeholder="Ej. Lunes mañana"
                maxLength={50}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d] focus:border-transparent transition-all"
              />
              {groupNameError && <p className="text-xs text-red-500 font-medium">{groupNameError}</p>}
              <p className="text-[10px] text-zinc-400">Solo letras. Primera letra en mayúscula automática.</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={isPending || !newGroupName.trim()}
                className="flex-1 rounded-xl bg-[#1fad9d] py-2.5 text-sm font-bold text-white hover:bg-[#0e7a70] disabled:opacity-50 transition-all"
              >
                {isPending ? 'Creando…' : 'Crear grupo'}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:border-zinc-300 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
