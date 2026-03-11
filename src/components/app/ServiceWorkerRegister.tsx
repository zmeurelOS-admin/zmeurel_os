'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
    if (!isSecure) return

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      } catch {
        // no-op
      }
    }

    register()
  }, [])

  return null
}
