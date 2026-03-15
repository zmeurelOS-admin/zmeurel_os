'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const START_STEP = 12
const MAX_IN_PROGRESS = 82
const COMPLETE = 100

function isInternalHref(href: string) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false
  }

  try {
    const url = new URL(href, window.location.href)
    return url.origin === window.location.origin
  } catch {
    return false
  }
}

export function RouteTransitionIndicator() {
  const pathname = usePathname()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousPathRef = useRef(pathname)
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)

  const clearTimers = useEffectEvent(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    timerRef.current = null
    hideTimerRef.current = null
  })

  const start = useEffectEvent(() => {
    clearTimers()
    setActive(true)
    setProgress(START_STEP)

    timerRef.current = setInterval(() => {
      setProgress((current) => {
        if (current >= MAX_IN_PROGRESS) return current
        const next = current + Math.max(3, (MAX_IN_PROGRESS - current) * 0.08)
        return Math.min(MAX_IN_PROGRESS, next)
      })
    }, 120)
  })

  const finish = useEffectEvent(() => {
    clearTimers()
    setProgress(COMPLETE)
    hideTimerRef.current = setTimeout(() => {
      setActive(false)
      setProgress(0)
    }, 180)
  })

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target as Element | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return

      const href = anchor.getAttribute('href') ?? ''
      if (!isInternalHref(href)) return

      const nextPath = new URL(href, window.location.href).pathname
      if (nextPath === previousPathRef.current) return

      start()
    }

    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [])

  useEffect(() => {
    if (pathname !== previousPathRef.current) {
      previousPathRef.current = pathname
      const frame = window.requestAnimationFrame(() => {
        finish()
      })

      return () => window.cancelAnimationFrame(frame)
    }
  }, [pathname])

  useEffect(() => {
    return () => clearTimers()
  }, [])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[120] h-1 transition-opacity duration-150 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className="h-full bg-[var(--agri-primary)] shadow-[0_0_12px_rgba(22,101,52,0.35)] transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
