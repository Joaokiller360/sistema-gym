import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { AdminPage, PageHeader } from '@/components/admin/ui'
import { CrmInbox } from './CrmInbox'
import { getConversationAction, listConversationsAction, type CrmThread } from './actions'

interface CrmConfig { enabled: boolean; webhookSigned: boolean }

interface Props {
  searchParams: Promise<{ c?: string }>
}

export default async function CrmPage({ searchParams }: Props) {
  const { c } = await searchParams
  const token = (await cookies()).get('session')?.value ?? ''

  const [config, list, thread] = await Promise.all([
    apiFetch<CrmConfig>('/admin/crm/config', token, { silent: true }),
    listConversationsAction('ALL'),
    c ? getConversationAction(c) : Promise.resolve(null),
  ])

  return (
    <AdminPage className="max-w-[1440px]">
      <PageHeader eyebrow="Conversaciones de WhatsApp con los dueños de gimnasios" title="CRM" />
      <CrmInbox
        config={config ?? { enabled: false, webhookSigned: false }}
        initialList={'error' in list ? { data: [], counts: {} } : list}
        initialThread={thread && !('error' in thread) ? (thread as CrmThread) : null}
        loadError={'error' in list ? list.error : null}
      />
    </AdminPage>
  )
}
