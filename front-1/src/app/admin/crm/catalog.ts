import type { CrmProduct } from './actions'

export const CURRENCIES = ['USD', 'ARS', 'EUR', 'MXN', 'CLP', 'COP', 'PEN', 'UYU']

export function fmtPrice(p: Pick<CrmProduct, 'price' | 'currency'>) {
  return p.price === null
    ? 'A consultar'
    : new Intl.NumberFormat('es-AR', { style: 'currency', currency: p.currency }).format(p.price)
}

/** Same text the back sends with the photo (crm-catalog.service.ts → caption) */
export function productCaption(p: Pick<CrmProduct, 'name' | 'description' | 'price' | 'currency'>) {
  const price = p.price === null ? 'Precio: a consultar' : `Precio: ${fmtPrice(p)}`
  return [`*${p.name}*`, p.description, price].filter(Boolean).join('\n\n')
}

/** Longest side capped and re-encoded as JPEG: WhatsApp-friendly and under the action body limit */
export async function fitJpeg(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // transparent PNGs would turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.85),
  )
}
