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

    // La prima vizită nu există încă un service worker care controlează pagina: `clientsClaim` (next.config) o preia
    // imediat și declanșează `controllerchange`. Reîncărcăm doar la o versiune nouă (exista deja un controller),
    // nu la prima preluare: altfel pagina se reîncărca în mijlocul pornirii demo-ului (promptul 31).
    const aveaController = Boolean(navigator.serviceWorker.controller)
    let seReincarca = false

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
          if (!aveaController || seReincarca) return
          seReincarca = true
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
