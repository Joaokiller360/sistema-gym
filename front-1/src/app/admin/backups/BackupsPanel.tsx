'use client'

import { useEffect, useState, useTransition } from 'react'
import { DatabaseBackup, Download, FolderArchive, Loader2, Trash2 } from 'lucide-react'
import { EmptyState, Panel, Pill, btn, td, th } from '@/components/admin/ui'
import {
  backupDownloadAction,
  deleteBackupAction,
  getBackupConfigAction,
  listBackupsAction,
  runBackupAction,
  type BackupConfig,
  type BackupFile,
} from './actions'

const dateFmt = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' })

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++ }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

/** "0 4 * * *" → "Todos los días a las 04:00"; anything else is shown as is */
function describeSchedule(cron: string) {
  const m = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(cron.trim())
  if (!m) return cron
  return `Todos los días a las ${m[2].padStart(2, '0')}:${m[1].padStart(2, '0')}`
}

interface Props {
  initialConfig: BackupConfig | null
  initialFiles: BackupFile[]
  loadError: string | null
}

export function BackupsPanel({ initialConfig, initialFiles, loadError }: Props) {
  const [config, setConfig] = useState(initialConfig)
  const [files, setFiles] = useState(initialFiles)
  const [error, setError] = useState<string | null>(loadError)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const running = config?.running ?? false

  // The copy runs on the API: check every few seconds until it finishes
  useEffect(() => {
    if (!running) return
    const timer = setInterval(async () => {
      const next = await getBackupConfigAction()
      if ('error' in next) return
      setConfig(next)
      if (!next.running) {
        const list = await listBackupsAction()
        if (!('error' in list)) setFiles(list)
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [running])

  function runNow() {
    setError(null)
    startTransition(async () => {
      const res = await runBackupAction()
      if (res.error) { setError(res.error); return }
      const next = await getBackupConfigAction()
      if (!('error' in next)) setConfig(next)
    })
  }

  function download(key: string) {
    setError(null)
    setBusyKey(key)
    startTransition(async () => {
      const res = await backupDownloadAction(key)
      setBusyKey(null)
      if ('error' in res) { setError(res.error); return }
      window.location.href = res.url
    })
  }

  function remove(key: string) {
    setError(null)
    setBusyKey(key)
    startTransition(async () => {
      const res = await deleteBackupAction(key)
      setBusyKey(null)
      setConfirmKey(null)
      if (res.error) { setError(res.error); return }
      setFiles(prev => prev.filter(f => f.key !== key))
    })
  }

  if (!config?.enabled) {
    return (
      <Panel>
        <EmptyState icon={<DatabaseBackup className="size-10" />}>
          <p className="font-semibold text-adm-ink">Copias de seguridad sin configurar</p>
          <p className="max-w-md">
            Agregá <code className="font-admin-mono">S3_ENDPOINT</code>, <code className="font-admin-mono">S3_BUCKET</code>,{' '}
            <code className="font-admin-mono">S3_ACCESS_KEY</code> y <code className="font-admin-mono">S3_SECRET_KEY</code> en
            las variables del back y redeployá.
          </p>
          {error && <p role="alert" className="text-xs font-semibold text-adm-bad-fg">{error}</p>}
        </EmptyState>
      </Panel>
    )
  }

  const last = config.lastRun

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Copia automática"
        action={(
          <button type="button" onClick={runNow} disabled={running || isPending} className={btn.primary}>
            {running ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <DatabaseBackup className="size-4" aria-hidden="true" />}
            {running ? 'Copiando…' : 'Crear copia ahora'}
          </button>
        )}
        bodyClassName="grid gap-4 px-5 py-4 sm:grid-cols-3"
      >
        <div>
          <p className="text-xs font-semibold text-adm-muted">Frecuencia</p>
          <p className="text-sm font-semibold">{describeSchedule(config.schedule)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-adm-muted">Se guardan</p>
          <p className="text-sm font-semibold">{config.retentionDays} días en <span className="font-admin-mono">{config.bucket}</span></p>
        </div>
        <div>
          <p className="text-xs font-semibold text-adm-muted">Última copia</p>
          {!last ? (
            <p className="text-sm text-adm-muted">Ninguna desde el último reinicio</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {last.ok === null ? <Pill tone="info">En curso</Pill> : last.ok ? <Pill tone="ok">Correcta</Pill> : <Pill tone="bad">Falló</Pill>}
              <span>{dateFmt.format(new Date(last.startedAt))}</span>
              <span className="text-adm-muted">· {last.trigger === 'cron' ? 'automática' : 'manual'}</span>
            </div>
          )}
        </div>
        {last?.error && (
          <p className="sm:col-span-3 rounded-lg border border-adm-bad-line bg-adm-bad-bg px-3 py-2 font-admin-mono text-xs text-adm-bad-fg break-words">
            {last.error}
          </p>
        )}
      </Panel>

      {error && <p role="alert" className="text-sm font-semibold text-adm-bad-fg">{error}</p>}

      <Panel title="Copias guardadas" action={<span className="text-xs text-adm-muted">{files.length} archivos</span>}>
        {files.length === 0 ? (
          <EmptyState icon={<FolderArchive className="size-10" />}>Todavía no hay copias en el bucket.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Contenido</th>
                  <th className={th}>Fecha</th>
                  <th className={th}>Tamaño</th>
                  <th className={th}><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.key}>
                    <td className={td}>
                      <div className="flex items-center gap-2 font-semibold">
                        {f.kind === 'db'
                          ? <DatabaseBackup className="size-4 text-adm-muted" aria-hidden="true" />
                          : <FolderArchive className="size-4 text-adm-muted" aria-hidden="true" />}
                        {f.kind === 'db' ? 'Base de datos' : 'Archivos (uploads)'}
                      </div>
                      <p className="mt-0.5 font-admin-mono text-xs text-adm-muted">{f.key}</p>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{dateFmt.format(new Date(f.createdAt))}</td>
                    <td className={`${td} whitespace-nowrap font-admin-mono`}>{formatSize(f.size)}</td>
                    <td className={`${td} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        {confirmKey === f.key ? (
                          <>
                            <button type="button" onClick={() => remove(f.key)} disabled={busyKey === f.key} className={btn.dangerSolid}>
                              Eliminar
                            </button>
                            <button type="button" onClick={() => setConfirmKey(null)} className={btn.line}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => download(f.key)} disabled={busyKey === f.key} className={btn.line}>
                              <Download className="size-3.5" aria-hidden="true" />
                              Descargar
                            </button>
                            <button type="button" onClick={() => setConfirmKey(f.key)} className={btn.icon} aria-label={`Eliminar ${f.key}`}>
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
