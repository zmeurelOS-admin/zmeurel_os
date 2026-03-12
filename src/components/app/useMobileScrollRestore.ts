'use client'

import { useEffect, useRef } from 'react'

const MOBILE_MEDIA_QUERY = '(max-width: 1023px)'

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

function restoreScroll(value: number) {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: value, behavior: 'auto' })
  })
}

interface UseMobileScrollRestoreOptions {
  storageKey: string
  ready?: boolean
}

export function useMobileScrollRestore({
  storageKey,
  ready = true,
}: UseMobileScrollRestoreOptions) {
  const hasRestored = useRef(false)

  useEffect(() => {
    if (!ready || hasRestored.current || !isMobileViewport()) return

    const storedValue = window.sessionStorage.getItem(storageKey)
    if (!storedValue) {
      hasRestored.current = true
      return
    }

    const scrollY = Number(storedValue)
    if (!Number.isFinite(scrollY)) {
      hasRestored.current = true
      return
    }

    restoreScroll(scrollY)
    hasRestored.current = true
  }, [ready, storageKey])

  useEffect(() => {
    if (!isMobileViewport()) return

    const saveScrollPosition = () => {
      window.sessionStorage.setItem(storageKey, String(window.scrollY || 0))
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveScrollPosition()
      }
    }

    window.addEventListener('pagehide', saveScrollPosition)
    window.addEventListener('beforeunload', saveScrollPosition)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      saveScrollPosition()
      window.removeEventListener('pagehide', saveScrollPosition)
      window.removeEventListener('beforeunload', saveScrollPosition)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [storageKey])
}
