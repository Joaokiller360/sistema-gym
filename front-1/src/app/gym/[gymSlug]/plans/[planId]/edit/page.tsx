import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ gymSlug: string; planId: string }>
}

// Plans are edited from the side panel on the plans list.
export default async function EditPlanPage({ params }: Props) {
  const { gymSlug, planId } = await params
  redirect(`/gym/${gymSlug}/plans?edit=${encodeURIComponent(planId)}`)
}
