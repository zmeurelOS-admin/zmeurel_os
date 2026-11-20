'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Mărimea textului și a butoanelor (Setări › Aspect): `normal` sau `large`.
 * Se ține pe dispozitiv (`localStorage`, cheia `ui_preferences`) și se pune pe <html> ca `data-density`.
 * Valoarea veche `compact` (interfața compactă, scoasă pe 20.11) se citește ca `normal`.
 */
export type DensityMode = 'normal' | 'large'

interface UiPreferences {
  density: DensityMode
}

interface DensityContextValue {
  density: DensityMode
  setDensity: (density: DensityMode) => void
}

const STORAGE_KEY = 'ui_preferences'
const DEFAULT_PREFERENCES: UiPreferences = { density: 'normal' }

const DensityContext = createContext<DensityContextValue | null>(null)

export function parseDensity(value: unknown): DensityMode {
  return value === 'large' ? 'large' : 'normal'
}

function readPreferences(): UiPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<Record<keyof UiPreferences, unknown>>
    return { density: parseDensity(parsed.density) }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function writePreferences(preferences: UiPreferences) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Mod privat / spațiu plin: alegerea rămâne doar pentru sesiunea de acum.
  }
}

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<DensityMode>(() => readPreferences().density)

  useEffect(() => {
    writePreferences({ density })
    document.documentElement.dataset.density = density
  }, [density])

  const value = useMemo<DensityContextValue>(
    () => ({
      density,
      setDensity: (nextDensity: DensityMode) => setDensityState(nextDensity),
    }),
    [density]
  )

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>
}

export function useDensity() {
  const context = useContext(DensityContext)
  if (!context) {
    throw new Error('useDensity must be used within DensityProvider')
  }
  return context
}
