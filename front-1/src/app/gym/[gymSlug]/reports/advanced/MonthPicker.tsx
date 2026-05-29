'use client'

import { useRouter } from 'next/navigation'

export function MonthPicker({ defaultMonth }: { defaultMonth: string }) {
  const router = useRouter()
  return (
    <input
      type="month"
      defaultValue={defaultMonth}
      onChange={e => { if (e.target.value) router.push(`?month=${e.target.value}`) }}
      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 transition-all"
    />
  )
}
