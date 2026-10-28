'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btn } from '@/components/admin/ui'
import { setWaProfilePhotoAction } from './actions'

/** Meta's recommended size for the profile photo */
const SIDE = 640

/** Center-crops to a 640×640 JPEG: what WhatsApp shows anyway, and small enough for the server action limit. */
async function squareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const crop = Math.min(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIDE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // transparent PNGs would turn black as JPEG
  ctx.fillRect(0, 0, SIDE, SIDE)
  ctx.drawImage(bmp, (bmp.width - crop) / 2, (bmp.height - crop) / 2, crop, crop, 0, 0, SIDE, SIDE)
  bmp.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.9),
  )
}

/** Business number's WhatsApp photo, the one gyms see in their chat. */
export function WaProfilePhoto({ initialUrl }: { initialUrl: string | null }) {
  const [src, setSrc] = useState(initialUrl)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setDone(false)
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('Solo JPG o PNG'); return }
    startTransition(async () => {
      let blob: Blob
      try { blob = await squareJpeg(file) } catch { setError('No se pudo leer la imagen'); return }
      const fd = new FormData()
      fd.append('photo', blob, 'profile.jpg')
      const res = await setWaProfilePhotoAction(fd)
      if ('error' in res) { setError(res.error); return }
      // Meta can take a while to serve the new photo: show the one just uploaded
      setSrc(URL.createObjectURL(blob))
      setDone(true)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3 rounded-[14px] border border-adm-line bg-adm-surface p-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          aria-label="Cambiar foto de perfil de WhatsApp"
          className="relative size-12 shrink-0 rounded-full bg-adm-brand outline-offset-2 focus-visible:outline-2 focus-visible:outline-adm-ink"
        >
          <span className="flex size-full items-center justify-center overflow-hidden rounded-full">
            {src
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={src} alt="" className="size-full object-cover" />
              : <Camera className="size-5 text-adm-night" aria-hidden="true" />}
          </span>
          <span className="absolute -right-0.5 -bottom-0.5 flex size-5.5 items-center justify-center rounded-full border-2 border-adm-surface bg-adm-ink text-adm-surface">
            {isPending ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Camera className="size-3" aria-hidden="true" />}
          </span>
        </button>
        <div className="pr-1.5">
          <p className="text-sm font-bold">Foto de WhatsApp</p>
          <p className="text-xs text-adm-muted" aria-live="polite">
            {isPending ? 'Subiendo…' : done ? 'Actualizada' : 'La ven los gyms en su chat'}
          </p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={isPending} className={cn(btn.line, 'bg-adm-subtle font-bold')}>
          Cambiar foto
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png" onChange={pick} className="sr-only" tabIndex={-1} aria-hidden="true" />
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-adm-bad-fg">{error}</p>}
    </div>
  )
}
