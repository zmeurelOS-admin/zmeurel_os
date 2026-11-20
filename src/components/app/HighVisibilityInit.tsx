'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

/**
 * Contrast ridicat (Setări › Aspect): clasa `high-visibility-mode` pe <html>.
 * Schimbă doar culorile și bordurile (tokenii canonici, în globals.css); mărimea e separată (`data-density`).
 * Se ține pe dispozitiv, în `localStorage` (`agri.highVisibility` = '1').
 */
export const HIGH_CONTRAST_STORAGE_KEY = 'agri.highVisibility'
const HIGH_CONTRAST_CLASS = 'high-visibility-mode'

const listeners = new Set<() => void>()

function readHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(HIGH_CONTRAST_STORAGE_KEY) === '1'
  } catch {
    return document.documentElement.classList.contains(HIGH_CONTRAST_CLASS)
  }
}

function applyHighContrast(enabled: boolean) {
  document.documentElement.classList.toggle(HIGH_CONTRAST_CLASS, enabled)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function HighVisibilityInit() {
  useEffect(() => {
    applyHighContrast(readHighContrast())
  }, [])

  return null
}

/** Starea și comutatorul pentru ecranul Aspect (și textul din lista Setări). */
export function useHighContrast(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, readHighContrast, () => false)

  const update = useCallback((next: boolean) => {
    try {
      if (next) window.localStorage.setItem(HIGH_CONTRAST_STORAGE_KEY, '1')
      else window.localStorage.removeItem(HIGH_CONTRAST_STORAGE_KEY)
    } catch {
      // Mod privat: rămâne doar pentru sesiunea de acum (clasa de pe <html>).
    }
    applyHighContrast(next)
    listeners.forEach((listener) => listener())
  }, [])

  return [enabled, update]
}
