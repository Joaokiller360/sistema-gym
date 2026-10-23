import { AdminPage, PageHeader } from '@/components/admin/ui'
import { listAllTicketsAction } from './actions'
import { SupportAdminClient } from './SupportAdminClient'

export default async function AdminSupportPage() {
  const tickets = await listAllTicketsAction()

  const open = tickets.filter(t => t.status === 'OPEN').length
  const urgent = tickets.filter(t => t.priority === 'URGENT' && t.status === 'OPEN').length

  return (
    <AdminPage>
      <PageHeader
        eyebrow={
          <>
            {open} ticket{open !== 1 ? 's' : ''} abierto{open !== 1 ? 's' : ''}
            {urgent > 0 && <span className="ml-1.5 font-semibold text-adm-bad-fg">· {urgent} urgente{urgent !== 1 ? 's' : ''}</span>}
          </>
        }
        title="Soporte"
      />
      <SupportAdminClient tickets={tickets} />
    </AdminPage>
  )
}
