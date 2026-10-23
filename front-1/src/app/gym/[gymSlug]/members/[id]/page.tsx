import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ gymSlug: string; id: string }>
  searchParams: Promise<{ edit?: string }>
}

// The member profile lives in the members list modal; keep old links working.
export default async function MemberDetailPage({ params, searchParams }: Props) {
  const { gymSlug, id } = await params
  const { edit } = await searchParams
  const query = new URLSearchParams({ member: id })
  if (edit === 'member') query.set('edit', 'member')
  redirect(`/gym/${gymSlug}/members?${query.toString()}`)
}
