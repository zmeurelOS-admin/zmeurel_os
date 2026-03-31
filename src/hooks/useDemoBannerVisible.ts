'use client'

import { useEffect, useState } from 'react'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'

const DISMISSED_KEY = 'demo_banner_dismissed'
const DISMISS_EVENT = 'zmeurel:demoBannerDismissed'

/** Call this to dismiss the banner and notify all subscribers. */
export function dispatchDemoBannerDismissed() {
  sessionStorage.setItem(DISMISSED_KEY, '1')
  window.dispatchEvent(new CustomEvent(DISMISS_EVENT))
}

/** Returns true when the demo banner is currently visible (demo user + not dismissed). */
export function useDemoBannerVisible(): boolean {
  const { email } = useDashboardAuth()
  const isDemo = email?.includes('@demo.zmeurel.local') ?? false
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    return sessionStorage.getItem(DISMISSED_KEY) === '1'
  })

  useEffect(() => {
    const handler = () => setDismissed(true)
    window.addEventListener(DISMISS_EVENT, handler)
    return () => window.removeEventListener(DISMISS_EVENT, handler)
  }, [])

  return isDemo && !dismissed
}
