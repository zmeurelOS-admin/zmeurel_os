'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type DensityMode = 'compact' | 'normal'

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

function readPreferences(): UiPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<UiPreferences>
    return {
      density: parsed.density === 'normal' ? 'normal' : 'compact',
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function writePreferences(preferences: UiPreferences) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<DensityMode>(() => readPreferences().density)

  useEffect(() => {
    writePreferences({ density })
    document.documentElement.dataset.density = density
  }, [density])

  const setDensity = (nextDensity: DensityMode) => {
    setDensityState(nextDensity)
  }

  const value = useMemo<DensityContextValue>(
    () => ({
      density,
      setDensity,
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

