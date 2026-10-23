import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ gymSlug: string }>
}

// Plans are created from the side panel on the plans list.
export default async function NewPlanPage({ params }: Props) {
  const { gymSlug } = await params
  redirect(`/gym/${gymSlug}/plans?new=plan`)
}
