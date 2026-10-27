import { defineMessages } from '@/i18n/config'

export const communicationsMessages = defineMessages({
  es: {
    title: 'Comunicaciones',
    none: 'Sin mensajes aún',
    count: (n: number) => `${n} mensaje${n !== 1 ? 's' : ''}`,
    supportTeam: 'Equipo de soporte',
    emptyTitle: 'Bandeja vacía',
    emptyHint: 'Los mensajes del equipo de soporte aparecerán aquí',
  },
  en: {
    title: 'Communications',
    none: 'No messages yet',
    count: (n: number) => `${n} message${n !== 1 ? 's' : ''}`,
    supportTeam: 'Support team',
    emptyTitle: 'Inbox empty',
    emptyHint: 'Messages from the support team will show up here',
  },
})
