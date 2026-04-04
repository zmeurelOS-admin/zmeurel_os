'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'

const STORAGE_KEY = 'zmeurel_last_context'

/**
 * Persistă preferința fermă vs asociație și restaurează asociația la revenire pe /dashboard
 * doar la primul mount al sesiunii client (nu la navigări ulterioare către /dashboard).
 */
export function useLastDashboardContext() {
  const pathname = usePathname()
  const router = useRouter()
  const { associationRole } = useDashboardAuth()
  const initialHandledRef = useRef(false)

  useEffect(() => {
    if (!initialHandledRef.current) {
      initialHandledRef.current = true
      if (pathname === '/dashboard' && associationRole) {
        try {
          if (localStorage.getItem(STORAGE_KEY) === 'association') {
            router.replace('/asociatie')
            return
          }
        } catch {
          /* ignore */
        }
      }
    }

    try {
      if (pathname.startsWith('/asociatie')) {
        localStorage.setItem(STORAGE_KEY, 'association')
      } else {
        localStorage.setItem(STORAGE_KEY, 'farm')
      }
    } catch {
      /* ignore */
    }
  }, [pathname, associationRole, router])
}
