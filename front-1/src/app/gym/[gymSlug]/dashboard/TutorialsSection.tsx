'use client'

import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { filterInput } from '@/lib/sanitize'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface TutorialItem {
  id: string
  title: string
  videoUrl: string
}

interface Props {
  canManage: boolean
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  )
  return match ? match[1] : null
}

export function TutorialsSection({ canManage }: Props) {
  const [items, setItems] = useState<TutorialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeItem, setActiveItem] = useState<TutorialItem | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/content/tutorials')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function resetForm() {
    setTitle('')
    setUrl('')
  }

  async function handleAdd() {
    if (!title.trim()) { toast.error('Ingresá un título'); return }
    if (!extractYoutubeId(url.trim())) { toast.error('URL de YouTube inválida'); return }
    setSaving(true)
    const res = await fetch('/api/v1/content/tutorials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, videoUrl: url.trim() }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Error al guardar'); return }
    const newItem = await res.json()
    setItems(prev => [...prev, newItem])
    toast.success('Tutorial agregado')
    setOpen(false)
    resetForm()
  }

  async function handleDelete(id: string) {
    const snapshot = items
    setDeleting(true)
    const res = await fetch(`/api/v1/content/tutorials/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setConfirmId(null)
    if (!res.ok) {
      toast.error('Error al eliminar el tutorial')
      setItems(snapshot)
      return
    }
    setItems(prev => prev.filter(i => i.id !== id))
    if (activeItem?.id === id) setActiveItem(null)
    toast.success('Tutorial eliminado')
  }

  const itemToDelete = confirmId ? items.find(i => i.id === confirmId) : null

  return (
    <>
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#1fad9d]" />
            <h2 className="font-semibold">Tutoriales</h2>
          </div>
          {canManage && (
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#1fad9d]/10 text-[#1fad9d] hover:bg-[#1fad9d]/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar video
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canManage ? 'Sin tutoriales. Agregá un video de YouTube.' : 'Sin tutoriales disponibles aún.'}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map(t => (
              <div key={t.id} className="rounded-lg border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                  <button
                    onClick={() => setActiveItem(t)}
                    aria-label={`Ver tutorial: ${t.title}`}
                    className="text-sm font-medium text-left hover:text-[#1fad9d] transition-colors flex-1"
                  >
                    {t.title}
                  </button>
                  {canManage && (
                    <button
                      onClick={() => setConfirmId(t.id)}
                      aria-label={`Eliminar tutorial: ${t.title}`}
                      className="ml-3 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmId} onOpenChange={v => { if (!v) setConfirmId(null) }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar tutorial</DialogTitle>
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

      {/* Video player modal */}
      <Dialog open={!!activeItem} onOpenChange={v => { if (!v) setActiveItem(null) }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-base">{activeItem?.title}</DialogTitle>
          </DialogHeader>
          {activeItem && (() => {
            const videoId = extractYoutubeId(activeItem.videoUrl)
            return videoId ? (
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                  title={activeItem.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  className="w-full h-full"
                />
              </div>
            ) : (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Video no disponible.</p>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Add tutorial modal */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar tutorial</DialogTitle>
            <DialogDescription>Pegá una URL de YouTube para agregar un tutorial.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Título</label>
              <input
                value={title}
                onChange={e => setTitle(filterInput(e.target.value))}
                placeholder="Ej: Cómo registrar un miembro"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">URL de YouTube</label>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1fad9d]"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 rounded-lg bg-[#1fad9d] text-white text-sm font-medium py-2 hover:bg-[#1fad9d]/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
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
