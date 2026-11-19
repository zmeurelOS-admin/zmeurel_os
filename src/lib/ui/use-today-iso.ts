'use client'

import { useSyncExternalStore } from 'react'

import { getLocalTodayIsoDate } from '@/lib/ui/app-date-picker-utils'

/** Pagina rămasă deschisă peste noapte trece singură pe ziua nouă. */
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

const noServerDay = () => null

/**
 * Ziua de azi, pe ceasul telefonului (`2026-11-19`). `null` pe server și la prima randare:
 * serverul are alt fus orar, iar după miezul nopții ar afișa ziua greșită.
 */
export function useTodayIso(): string | null {
  return useSyncExternalStore(subscribeToDayChange, getLocalTodayIsoDate, noServerDay)
}
