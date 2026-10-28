'use server'

import { cookies } from 'next/headers'
import { apiFetchWithError } from '@/lib/api'

export interface BackupFile {
  key: string
  kind: 'db' | 'uploads'
  size: number
  createdAt: string
}

export interface BackupRun {
  startedAt: string
  finishedAt: string | null
  trigger: 'cron' | 'manual'
  ok: boolean | null
  files: string[]
  error: string | null
}

export interface BackupConfig {
  enabled: boolean
  bucket: string | null
  retentionDays: number
  schedule: string
  running: boolean
  lastRun: BackupRun | null
}

async function token() {
  return (await cookies()).get('session')?.value ?? ''
}

export async function getBackupConfigAction(): Promise<BackupConfig | { error: string }> {
  const res = await apiFetchWithError<BackupConfig>('/admin/backups/config', await token(), { cache: 'no-store' })
  return 'error' in res ? res : res.data
}

export async function listBackupsAction(): Promise<BackupFile[] | { error: string }> {
  const res = await apiFetchWithError<BackupFile[]>('/admin/backups', await token(), { cache: 'no-store' })
  return 'error' in res ? res : res.data
}

/** Runs in the background on the API; poll getBackupConfigAction for the result */
export async function runBackupAction() {
  const res = await apiFetchWithError<unknown>('/admin/backups', await token(), { method: 'POST' })
  return 'error' in res ? { error: res.error } : {}
}

/** Signed MinIO link valid for 5 minutes */
export async function backupDownloadAction(key: string): Promise<{ url: string } | { error: string }> {
  const res = await apiFetchWithError<{ url: string }>('/admin/backups/download', await token(), {
    method: 'POST',
    body: JSON.stringify({ key }),
  })
  return 'error' in res ? res : res.data
}

export async function deleteBackupAction(key: string) {
  const res = await apiFetchWithError<unknown>('/admin/backups', await token(), {
    method: 'DELETE',
    body: JSON.stringify({ key }),
  })
  return 'error' in res ? { error: res.error } : {}
}
