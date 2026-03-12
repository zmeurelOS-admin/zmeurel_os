'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

type PendingNav = {
  from: string
  to: string
  start: number
  markStart: string
  markEnd: string
  measure: string
}

const PERF_ENABLED = process.env.NEXT_PUBLIC_PERF_LOG === 'true'

function safePathFromHref(href: string): string | null {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null
  }

  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return null
    return url.pathname
  } catch {
    return null
  }
}

export function NavigationPerfLogger() {
  const pathname = usePathname()
  const currentPathRef = useRef(pathname)
  const pendingRef = useRef<PendingNav | null>(null)

  useEffect(() => {
    if (!PERF_ENABLED) return

    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target as Element | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return

      const toPath = safePathFromHref(anchor.getAttribute('href') ?? '')
      if (!toPath) return

      const fromPath = currentPathRef.current
      if (!fromPath || toPath === fromPath) return

      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const markStart = `nav_click_${id}`
      const markEnd = `nav_commit_${id}`
      const measure = `nav_measure_${id}`

      performance.mark(markStart)
      pendingRef.current = {
        from: fromPath,
        to: toPath,
        start: performance.now(),
        markStart,
        markEnd,
        measure,
      }
    }

    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [])

  useEffect(() => {
    if (!PERF_ENABLED) {
      currentPathRef.current = pathname
      return
    }

    const pending = pendingRef.current
    if (pending && pathname === pending.to) {

      performance.mark(pending.markEnd)
      performance.measure(pending.measure, pending.markStart, pending.markEnd)


      performance.clearMarks(pending.markStart)
      performance.clearMarks(pending.markEnd)
      performance.clearMeasures(pending.measure)
      pendingRef.current = null
    }

    currentPathRef.current = pathname
  }, [pathname])

  return null
}
