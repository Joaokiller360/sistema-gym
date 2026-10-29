import { cookies } from 'next/headers'
import Link from 'next/link'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { AdminPage, PageHeader, btn } from '@/components/admin/ui'
import { AlertsToggle } from './AlertsToggle'
import { AwayReply } from './AwayReply'
import { WaProfilePhoto } from './WaProfilePhoto'
import { CrmInbox } from './CrmInbox'
import { getConversationAction, listConversationsAction, listQuickRepliesAction, type AwayConfig, type CrmThread, type WaProfile } from './actions'

interface CrmConfig { enabled: boolean; webhookSigned: boolean; alertsPaused: boolean; away: AwayConfig }

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
            <Link href="/admin/crm/catalogo" className={cn(btn.line, 'min-h-[52px] rounded-xl px-3.5')}>
              <Package className="size-4" aria-hidden="true" /> Catálogo
            </Link>
            {profile && <WaProfilePhoto initialUrl={profile.profilePictureUrl} />}
            {config && <AwayReply initial={config.away} />}
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
