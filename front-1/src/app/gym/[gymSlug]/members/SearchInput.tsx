'use client'

import { useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function SearchInput({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [value, setValue] = useState(defaultValue ?? '')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const filtered = raw.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
    setValue(filtered)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (filtered.trim()) params.set('q', filtered.trim())
      else params.delete('q')
      params.delete('page')
      router.push(`?${params.toString()}`)
    }, 400)
  }

  return (
    <div className="relative w-72">
      <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="Buscar miembro..."
        value={value}
        onChange={handleChange}
        className="pl-8"
        fieldType="search"
      />
    </div>
  )
}
