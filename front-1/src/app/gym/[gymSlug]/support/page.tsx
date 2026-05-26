import { cookies } from 'next/headers'
import { listGymTicketsAction } from './actions'
import { SupportClient } from './SupportClient'

interface Props {
  params: Promise<{ gymSlug: string }>
}

export default async function SupportPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  void token

  const tickets = await listGymTicketsAction(gymSlug)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Soporte</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Reportá problemas o solicitá ayuda al equipo de la plataforma
        </p>
      </div>
      <SupportClient gymSlug={gymSlug} initialTickets={tickets} />
    </div>
  )
}
