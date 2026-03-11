'use client'

import { useEffect, useState } from 'react'
import { SunMedium } from 'lucide-react'

const STORAGE_KEY = 'agri.highVisibility'

export function HighVisibilityToggle() {
  const [enabled, setEnabled] = useState(() =>
    typeof window === 'undefined' ? false : window.localStorage.getItem(STORAGE_KEY) === '1'
  )

  useEffect(() => {
    document.documentElement.classList.toggle('high-visibility-mode', enabled)
  }, [enabled])

  const onToggle = () => {
    const next = !enabled
    setEnabled(next)
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    document.documentElement.classList.toggle('high-visibility-mode', next)
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className="agri-control inline-flex h-10 min-w-10 items-center justify-center rounded-xl border-white/40 bg-white/20 px-3 text-white backdrop-blur transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      aria-label="Activeaza high visibility mode"
      title="High Visibility Mode"
    >
      <SunMedium className="h-4 w-4" />
    </button>
  )
}
