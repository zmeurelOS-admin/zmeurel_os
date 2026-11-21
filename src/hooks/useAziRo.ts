'use client'

import { useSyncExternalStore } from 'react'

import { aziRo } from '@/lib/tratamente/zile'

function subscribeToDayChange(onChange: () => void) {
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange()
  }
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(onChange, 60_000)
  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}
const readToday = () => aziRo()
const noServerDay = () => null

/** Ziua de azi în ora României (`YYYY-MM-DD`); se schimbă singură peste noapte. `null` pe server. */
export function useAziRo(): string | null {
  return useSyncExternalStore(subscribeToDayChange, readToday, noServerDay)
}
