import { defineMessages } from '@/i18n/config'

export const inventoryMessages = defineMessages({
  es: {
    title: 'Inventario',
    sections: 'Secciones del inventario',
    tabs: { equipment: 'Equipos', products: 'Productos', categories: 'Categorías' },
    count: (n: number) => `${n} ítem${n !== 1 ? 's' : ''}`,
    empty: 'Próximamente el inventario',
    colName: 'Nombre',
    colQuantity: 'Cantidad',
    colSerial: 'N° Serie',
    colStatus: 'Estado',
    status: { ACTIVE: 'Activo', OUT_OF_SERVICE: 'Fuera de servicio', MAINTENANCE: 'En mantenimiento', RETIRED: 'Retirado' },
  },
  en: {
    title: 'Inventory',
    sections: 'Inventory sections',
    tabs: { equipment: 'Equipment', products: 'Products', categories: 'Categories' },
    count: (n: number) => `${n} item${n !== 1 ? 's' : ''}`,
    empty: 'Inventory coming soon',
    colName: 'Name',
    colQuantity: 'Quantity',
    colSerial: 'Serial no.',
    colStatus: 'Status',
    status: { ACTIVE: 'Active', OUT_OF_SERVICE: 'Out of service', MAINTENANCE: 'Under maintenance', RETIRED: 'Retired' },
  },
})
