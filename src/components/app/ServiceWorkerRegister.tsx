'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
    if (!isSecure) return

    const promptUpdate = (registration: ServiceWorkerRegistration) => {
      if (!registration.waiting) return

      toast('Versiune nouă disponibilă. Reîmprospătează.', {
        duration: Infinity,
        action: {
          label: 'Reîmprospătează',
          onClick: () => {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
          },
        },
      })
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

        promptUpdate(registration)

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing
          if (!installingWorker) return

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              promptUpdate(registration)
            }
          })
        })

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload()
        })
      } catch {
        // no-op
      }
    }

    register()
  }, [])

  return null
}
