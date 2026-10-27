'use client'

import { useState } from 'react'
import { PHONE_COUNTRIES, joinPhone, phoneCountry, splitPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'

interface Props {
  id?: string
  /** Initial international number; the component keeps its own state afterwards. */
  defaultValue?: string | null
  /** Country preselected when there is no number yet (ISO code). */
  defaultCountry?: string | null
  /** Receives "+<dial><number>", or "" when the number is empty. */
  onChange: (value: string) => void
  disabled?: boolean
  selectClassName?: string
  inputClassName?: string
  'aria-describedby'?: string
}

export function PhoneInput({ id, defaultValue, defaultCountry, onChange, disabled, selectClassName, inputClassName, ...aria }: Props) {
  const [initial] = useState(() => splitPhone(defaultValue, defaultCountry))
  const [country, setCountry] = useState(initial.country)
  const [number, setNumber] = useState(initial.number)
  const dial = phoneCountry(country).dial

  function update(nextCountry: string, nextNumber: string) {
    setCountry(nextCountry)
    setNumber(nextNumber)
    onChange(joinPhone(nextCountry, nextNumber))
  }

  function handleNumber(raw: string) {
    // Pasted with its code (+593 98…): pick the country from it
    if (raw.trim().startsWith('+')) {
      const parsed = splitPhone(raw, country)
      update(parsed.country, parsed.number)
      return
    }
    update(country, raw.replace(/[^\d\s-]/g, ''))
  }

  return (
    <div className="flex gap-2">
      <select
        value={country}
        onChange={e => update(e.target.value, number)}
        disabled={disabled}
        aria-label="País"
        className={cn(selectClassName, 'w-auto shrink-0 cursor-pointer pr-2')}
      >
        {PHONE_COUNTRIES.map(c => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.name} +{c.dial}
          </option>
        ))}
      </select>
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-adm-muted font-admin-mono" aria-hidden="true">
          +{dial}
        </span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={number}
          onChange={e => handleNumber(e.target.value)}
          placeholder="98 666 0737"
          maxLength={18}
          disabled={disabled}
          className={cn(inputClassName, 'font-admin-mono')}
          style={{ paddingLeft: `${1.25 + (dial.length + 1) * 0.6}rem` }}
          {...aria}
        />
      </div>
    </div>
  )
}
