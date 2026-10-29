import { AdminPage, PageHeader } from '@/components/admin/ui'
import { listProductsAction } from '../actions'
import { CatalogManager } from './CatalogManager'

export default async function CrmCatalogPage() {
  const products = await listProductsAction()

  return (
    <AdminPage className="max-w-[1440px]">
      <PageHeader
        breadcrumb={[{ label: 'CRM', href: '/admin/crm' }, { label: 'Catálogo' }]}
        eyebrow="Lo que le ofrecés a los gimnasios, listo para mandar desde el chat"
        title="Catálogo"
      />
      {'error' in products
        ? <p role="alert" className="text-sm font-semibold text-adm-bad-fg">{products.error}</p>
        : <CatalogManager initial={products} />}
    </AdminPage>
  )
}
