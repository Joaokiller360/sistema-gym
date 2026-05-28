'use client'

import { useState, useEffect, useCallback } from 'react'
import { Newspaper, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { filterInput } from '@/lib/sanitize'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface NewsItem {
  id: string
  title: string
  content: string
  publishedAt: string
}

interface Props {
  canManage: boolean
}

export function NewsSection({ canManage }: Props) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/content/news')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function resetForm() {
    setTitle('')
    setBody('')
  }

  async function handleAdd() {
    if (!title.trim()) { toast.error('Ingresá un título'); return }
    if (!body.trim()) { toast.error('Ingresá el contenido'); return }
    setSaving(true)
    const res = await fetch('/api/v1/content/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Error al guardar'); return }
    const newItem = await res.json()
    setItems(prev => [newItem, ...prev])
    toast.success('Novedad publicada')
    setOpen(false)
    resetForm()
  }

  async function handleDelete(id: string) {
    const snapshot = items
    setDeleting(true)
    const res = await fetch(`/api/v1/content/news/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setConfirmId(null)
    if (!res.ok) {
      toast.error('Error al eliminar la novedad')
      setItems(snapshot)
      return
    }
    setItems(prev => prev.filter(i => i.id !== id))
    toast.success('Novedad eliminada')
  }

  const itemToDelete = confirmId ? items.find(i => i.id === confirmId) : null

  return (
    <>
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-[#1fad9d]" />
            <h2 className="font-semibold">Novedades</h2>
          </div>
          {canManage && (
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1fad9d]/10 text-[#1fad9d] hover:bg-[#1fad9d]/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva novedad
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin novedades publicadas.</p>
        ) : (
          <ul className="space-y-4">
            {items.map(item => (
              <li key={item.id} className="border-b last:border-0 pb-4 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">
                      {new Date(item.publishedAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{item.content}</p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => setConfirmId(item.id)}
                      aria-label={`Eliminar novedad: ${item.title}`}
                      className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0 mt-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmId} onOpenChange={v => { if (!v) setConfirmId(null) }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar novedad</DialogTitle>
            <DialogDescription>
              {itemToDelete
                ? `¿Eliminás "${itemToDelete.title}"? Esta acción no se puede deshacer.`
                : '¿Confirmás la eliminación?'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => confirmId && handleDelete(confirmId)}
              disabled={deleting}
              className="flex-1 rounded-lg bg-red-500 text-white text-sm font-medium py-2 hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
            <button
              onClick={() => setConfirmId(null)}
              disabled={deleting}
              className="flex-1 rounded-lg border text-sm font-medium py-2 hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add news dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva novedad</DialogTitle>
            <DialogDescription>Publicá una novedad visible para todos los gimnasios.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Título</label>
              <input
                value={title}
                onChange={e => setTitle(filterInput(e.target.value))}
                placeholder="Ej: Nueva funcionalidad disponible"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Contenido</label>
              <textarea
                value={body}
                onChange={e => setBody(filterInput(e.target.value))}
                placeholder="Describí la novedad..."
                rows={4}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d] resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 rounded-lg bg-[#1fad9d] text-white text-sm font-medium py-2 hover:bg-[#1fad9d]/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Publicando...' : 'Publicar'}
              </button>
              <button
                onClick={() => { setOpen(false); resetForm() }}
                className="flex-1 rounded-lg border text-sm font-medium py-2 hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
