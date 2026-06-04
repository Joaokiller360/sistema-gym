import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ gymSlug: string }>
}

export default async function AdvancedReportsRedirect({ params }: Props) {
  const { gymSlug } = await params
  redirect(`/gym/${gymSlug}/reports`)
}
