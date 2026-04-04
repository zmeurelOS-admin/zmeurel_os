'use client'

import { useEffect } from 'react'

/**
 * Blochează scroll-ul pe `document.body` când `locked` e true (ex. sheet-uri modale).
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked])
}
