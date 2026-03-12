'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

import { track } from '@/lib/analytics/track'

export function PageViewTracker() {
  const pathname = usePathname()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTrackedPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      if (lastTrackedPathRef.current === pathname) return
      lastTrackedPathRef.current = pathname
      track('page_view', { page: pathname })
    }, 250)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [pathname])

  return null
}
