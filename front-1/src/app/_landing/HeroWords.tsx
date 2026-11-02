'use client'

import { useEffect, useState } from 'react'
import s from './landing.module.css'

const WORDS = ['en orden.', 'sin planillas.', 'al día.', 'creciendo.']

/** "Tu gimnasio, <word>" with the word rolling every 2.4 s; readers get the first one, once */
export function HeroWords() {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setI(n => (n + 1) % WORDS.length), 2400)
    return () => clearInterval(id)
  }, [])

  const prev = (i + WORDS.length - 1) % WORDS.length
  return (
    <>
      <span className="sr-only">{WORDS[0]}</span>
      <span className={s.mask} aria-hidden="true">
        {WORDS.map((w, n) => (
          <span key={w} className={`${s.word} ${n === i ? s.wIn : n === prev ? s.wOut : s.wWait}`}>
            {w}
          </span>
        ))}
      </span>
    </>
  )
}
