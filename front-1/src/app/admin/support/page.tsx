import { listAllTicketsAction } from './actions'
import { SupportAdminClient } from './SupportAdminClient'

export default async function AdminSupportPage() {
  const tickets = await listAllTicketsAction()

  const open = tickets.filter(t => t.status === 'OPEN').length
  const urgent = tickets.filter(t => t.priority === 'URGENT' && t.status === 'OPEN').length

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Soporte</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {open} ticket{open !== 1 ? 's' : ''} abierto{open !== 1 ? 's' : ''}
          {urgent > 0 && <span className="ml-2 text-red-600 font-semibold">· {urgent} urgente{urgent !== 1 ? 's' : ''}</span>}
        </p>
      </div>
      <SupportAdminClient tickets={tickets} />
    </div>
  )
}
