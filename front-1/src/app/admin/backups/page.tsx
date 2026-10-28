import { AdminPage, PageHeader } from '@/components/admin/ui'
import { BackupsPanel } from './BackupsPanel'
import { getBackupConfigAction, listBackupsAction } from './actions'

export default async function AdminBackupsPage() {
  const [config, files] = await Promise.all([getBackupConfigAction(), listBackupsAction()])

  return (
    <AdminPage>
      <PageHeader eyebrow="Base de datos y archivos subidos, guardados en MinIO / S3" title="Copias de seguridad" />
      <BackupsPanel
        initialConfig={'error' in config ? null : config}
        initialFiles={'error' in files ? [] : files}
        loadError={'error' in config ? config.error : 'error' in files ? files.error : null}
      />
    </AdminPage>
  )
}
