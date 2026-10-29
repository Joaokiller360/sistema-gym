import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { AdminPage, PageHeader } from '@/components/admin/ui'
import { AlertsToggle } from './AlertsToggle'
import { WaProfilePhoto } from './WaProfilePhoto'
import { CrmInbox } from './CrmInbox'
import { getConversationAction, listConversationsAction, listQuickRepliesAction, type CrmThread, type WaProfile } from './actions'

interface CrmConfig { enabled: boolean; webhookSigned: boolean; alertsPaused: boolean }

/** Once per request: the client starts its countdowns from this, see useNow in CrmInbox */
const requestTime = () => Date.now()

interface Props {
  searchParams: Promise<{ c?: string }>
}

export default async function CrmPage({ searchParams }: Props) {
  const { c } = await searchParams
  const token = (await cookies()).get('session')?.value ?? ''

  const [config, profile, list, thread, quickReplies] = await Promise.all([
    apiFetch<CrmConfig>('/admin/crm/config', token, { silent: true }),
    // Fails without Zernio: the photo control is then hidden
    apiFetch<WaProfile>('/admin/crm/profile', token, { silent: true, cache: 'no-store' }),
    listConversationsAction('ALL'),
    c ? getConversationAction(c) : Promise.resolve(null),
    listQuickRepliesAction(),
  ])

  return (
    <AdminPage className="max-w-[1440px]">
      <PageHeader
        eyebrow="Conversaciones de WhatsApp con los dueños de gimnasios"
        title="CRM"
        actions={(
          <div className="flex flex-wrap items-start gap-2">
            {profile && <WaProfilePhoto initialUrl={profile.profilePictureUrl} />}
            {config && <AlertsToggle initialPaused={config.alertsPaused} />}
          </div>
        )}
      />
      <CrmInbox
        config={config ?? { enabled: false, webhookSigned: false }}
        initialList={'error' in list ? { data: [], counts: {} } : list}
        initialThread={thread && !('error' in thread) ? (thread as CrmThread) : null}
        initialQuickReplies={'error' in quickReplies ? [] : quickReplies}
        serverNow={requestTime()}
        loadError={'error' in list ? list.error : null}
      />
    </AdminPage>
  )
}
