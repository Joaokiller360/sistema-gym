'use client'

import { useRouter } from 'next/navigation'

interface Props {
  defaultValue: string
}

export function DateFilter({ defaultValue }: Props) {
  const router = useRouter()

  return (
    <input
      type="date"
      defaultValue={defaultValue}
      onChange={e => {
        if (e.target.value) router.push(`?date=${e.target.value}`)
      }}
      className="rounded-md border px-3 py-1.5 text-sm bg-background"
    />
  )
}
