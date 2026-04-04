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
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setMounted(true)
      setDismissed(sessionStorage.getItem(DISMISSED_KEY) === '1')
    }, 0)
    const handler = () => setDismissed(true)
    window.addEventListener(DISMISS_EVENT, handler)
    return () => {
      window.clearTimeout(syncTimer)
      window.removeEventListener(DISMISS_EVENT, handler)
    }
  }, [])

  return mounted && isDemo && !dismissed
}
