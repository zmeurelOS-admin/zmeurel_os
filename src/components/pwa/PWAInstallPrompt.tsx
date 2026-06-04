'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { isPublicNoPwaInstallPath } from '@/lib/pwa/public-install-paths'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISSED_KEY = 'pwa_dismissed'
const EXPIRY_DAYS = 90
const SHOW_DELAY_MS = 1800
const EXIT_DURATION_MS = 350

function isDismissed(): boolean {
  try {
    const val = window.localStorage.getItem(DISMISSED_KEY)
    if (!val) return false

    const parsed = JSON.parse(val) as { ts?: number }
    if (typeof parsed.ts !== 'number') return false

    return Date.now() - parsed.ts < EXPIRY_DAYS * 86400 * 1000
  } catch {
    return false
  }
}

function setDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify({ ts: Date.now() }))
  } catch {
    // no-op
  }
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

type PWAInstallPromptProps = {
  allowPublicPaths?: boolean
  iconSrc?: string
  title?: string
  subtitle?: string
  iconAlt?: string
}

export default function PWAInstallPrompt({
  allowPublicPaths = false,
  iconSrc = '/shop-icon-192.png',
  title = 'Fructe proaspete la o atingere',
  subtitle = 'Salvează magazinul pe ecran pentru când ai poftă.',
  iconAlt = 'Zmeurel',
}: PWAInstallPromptProps) {
  const pathname = usePathname()
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const delayElapsedRef = useRef(false)
  const showTimerRef = useRef<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }, [])

  const hideWithAnimation = useCallback(() => {
    clearExitTimer()
    setIsExiting(true)
    exitTimerRef.current = window.setTimeout(() => {
      setShowPrompt(false)
      setIsExiting(false)
    }, EXIT_DURATION_MS)
  }, [clearExitTimer])

  const maybeShowPrompt = useCallback(() => {
    if (!allowPublicPaths && isPublicNoPwaInstallPath(pathname)) return
    if (!delayElapsedRef.current) return
    if (!deferredPromptRef.current) return
    if (isStandaloneMode()) return
    if (isDismissed()) return

    setIsExiting(false)
    setShowPrompt(true)
  }, [allowPublicPaths, pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current)
    }

    showTimerRef.current = window.setTimeout(() => {
      delayElapsedRef.current = true
      maybeShowPrompt()
    }, SHOW_DELAY_MS)

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent
      promptEvent.preventDefault()
      deferredPromptRef.current = promptEvent
      maybeShowPrompt()
    }

    const handleAppInstalled = () => {
      deferredPromptRef.current = null
      if (showPrompt || isExiting) {
        hideWithAnimation()
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)

      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current)
      }

      clearExitTimer()
    }
  }, [clearExitTimer, hideWithAnimation, isExiting, maybeShowPrompt, showPrompt])

  const handleInstall = async () => {
    const deferredPrompt = deferredPromptRef.current
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice

    if (choice.outcome === 'accepted') {
      deferredPromptRef.current = null
      hideWithAnimation()
    }
  }

  const handleDismiss = () => {
    hideWithAnimation()
  }

  const handleNeverShow = () => {
    setDismissed()
    hideWithAnimation()
  }

  const dismissed = typeof window !== 'undefined' ? isDismissed() : false

  if (
    (!allowPublicPaths && isPublicNoPwaInstallPath(pathname)) ||
    !showPrompt ||
    isStandaloneMode() ||
    (dismissed && !isExiting)
  ) {
    return null
  }

  return (
    <div
      className={`pwa-prompt ${isExiting ? 'pwa-exit' : 'pwa-enter'} fixed bottom-0 left-1/2 z-[70] min-h-[35dvh] w-full max-w-[420px] -translate-x-1/2 overflow-hidden rounded-t-[22px] border border-[#f3dad4] bg-white shadow-[0_-22px_54px_rgba(232,93,93,0.18),0_-8px_22px_rgba(49,46,63,0.08)] sm:bottom-5 sm:rounded-[22px]`}
      aria-live="polite"
    >
      <div className="body flex min-h-[35dvh] flex-col items-center justify-center bg-[linear-gradient(180deg,#fffafa_0%,#fff5f5_100%)] px-5 py-5 text-center">
        <div className="mb-4 h-[3px] w-8 rounded-full bg-[#d6d3d1]" aria-hidden />

        <div className="flex flex-col items-center">
          <Image
            src={iconSrc}
            alt={iconAlt}
            width={52}
            height={52}
            className="h-[52px] w-[52px] rounded-[16px] border border-white/80 shadow-[0_12px_26px_rgba(232,93,93,0.35)]"
          />
          <div className="mt-4 max-w-[300px]">
            <p
              className="title text-lg leading-6 font-semibold tracking-[-0.01em] text-[#312E3F]"
              style={{ fontFamily: 'var(--font-comanda-display), inherit' }}
            >
              {title}
            </p>
            <p className="sub mt-2 text-sm leading-[1.45] text-gray-500">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="actions mt-5 flex w-full max-w-[300px] flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="w-full rounded-2xl bg-[#e85d5d] px-4 py-3 text-[14px] font-bold text-white shadow-[0_14px_26px_rgba(232,93,93,0.28)] transition hover:bg-[#dc5454] active:scale-[0.98]"
          >
            📲 Salvează pe telefon
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-[#8a7478] transition hover:bg-[#fff0f0] active:scale-[0.98]"
          >
            Amână
          </button>
        </div>

        <button
          type="button"
          onClick={handleNeverShow}
          className="mt-1 text-center text-[11px] font-semibold text-[#a08a8e] underline underline-offset-2"
        >
          Nu mai arăta
        </button>
      </div>
    </div>
  )
}
