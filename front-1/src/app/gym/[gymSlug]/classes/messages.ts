import { defineMessages } from '@/i18n/config'

export const classesMessages = defineMessages({
  es: {
    title: 'Clases',
    count: (n: number) => `${n} clase${n !== 1 ? 's' : ''}`,
    empty: 'Próximamente clases registradas',
    colClass: 'Clase',
    colDay: 'Día',
    colTime: 'Horario',
    colCapacity: 'Capacidad',
    colTrainer: 'Entrenador',
    colStatus: 'Estado',
  },
  en: {
    title: 'Classes',
    count: (n: number) => `${n} class${n !== 1 ? 'es' : ''}`,
    empty: 'Registered classes coming soon',
    colClass: 'Class',
    colDay: 'Day',
    colTime: 'Time',
    colCapacity: 'Capacity',
    colTrainer: 'Trainer',
    colStatus: 'Status',
  },
})
