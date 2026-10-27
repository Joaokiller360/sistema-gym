import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { ScanClient, type ScanMember, type ScanProduct } from './ScanClient'
import { getT } from '@/i18n/server'
import { attendanceMessages } from '../messages'

interface Props {
  params: Promise<{ gymSlug: string }>
}

export default async function ScanPage({ params }: Props) {
  const { gymSlug } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value ?? ''
  const t = (await getT(attendanceMessages)).scan

  const [products, members] = await Promise.all([
    apiFetch<(ScanProduct & { isActive: boolean })[]>('/store/products', token, {
      next: { tags: [`store-products-${gymSlug}`] },
      headers: { 'x-gym-slug': gymSlug },
      silent: true,
    }),
    apiFetch<ScanMember[]>('/members', token, {
      headers: { 'x-gym-slug': gymSlug },
      silent: true,
    }),
  ])

  const available = (products ?? [])
    .filter(p => p.isActive)
    .map(p => ({ id: p.id, name: p.name, price: p.price, stock: p.stock }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const memberList = (members ?? []).map(m => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email,
    phone: m.phone ?? null,
  }))

  return (
    <div className="admin-surface mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">
      <header>
        <p className="text-[13px] font-medium text-adm-muted">{t.frontDesk}</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-none tracking-tight [font-stretch:115%] sm:text-[40px]">{t.title}</h1>
        <p className="mt-2.5 max-w-xl text-[13px] text-adm-muted">
          {t.intro}
        </p>
      </header>
      <ScanClient gymSlug={gymSlug} products={available} members={memberList} />
    </div>
  )
}
