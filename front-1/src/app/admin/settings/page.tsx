import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { AdminPage, PageHeader, btn } from '@/components/admin/ui'
import { getPlatformSettingsAction } from './actions'
import { PlatformSettingsForm } from './PlatformSettingsForm'

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettingsAction()

  return (
    <AdminPage className="pb-0">
      <PageHeader
        eyebrow="Identidad, landing, footer y términos de la plataforma"
        title="Configuración"
        actions={
          <Link href="/" target="_blank" className={btn.line}>
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Ver landing
          </Link>
        }
      />
      <PlatformSettingsForm settings={settings} />
    </AdminPage>
  )
}
