import { defineMessages } from '@/i18n/config'

export const marketingMessages = defineMessages({
  es: {
    title: 'Marketing',
    count: (n: number) => `${n} campaña${n !== 1 ? 's' : ''}`,
    empty: 'No hay campañas creadas',
    colCampaign: 'Campaña',
    colStatus: 'Estado',
    colScheduled: 'Programada',
    colSent: 'Enviada',
    colMetrics: 'Métricas',
    sent: (n: number) => `${n} enviados`,
    opened: (n: number) => ` · ${n} abiertos`,
    status: { DRAFT: 'Borrador', SCHEDULED: 'Programada', SENT: 'Enviada', CANCELLED: 'Cancelada' },
  },
  en: {
    title: 'Marketing',
    count: (n: number) => `${n} campaign${n !== 1 ? 's' : ''}`,
    empty: 'No campaigns yet',
    colCampaign: 'Campaign',
    colStatus: 'Status',
    colScheduled: 'Scheduled',
    colSent: 'Sent',
    colMetrics: 'Metrics',
    sent: (n: number) => `${n} sent`,
    opened: (n: number) => ` · ${n} opened`,
    status: { DRAFT: 'Draft', SCHEDULED: 'Scheduled', SENT: 'Sent', CANCELLED: 'Cancelled' },
  },
})
