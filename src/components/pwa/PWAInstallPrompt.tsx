'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

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

export default function PWAInstallPrompt() {
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
    if (pathname !== '/') return
    if (!delayElapsedRef.current) return
    if (!deferredPromptRef.current) return
    if (isStandaloneMode()) return
    if (isDismissed()) return

    setIsExiting(false)
    setShowPrompt(true)
  }, [pathname])

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

  if (pathname !== '/' || !showPrompt || isStandaloneMode() || (dismissed && !isExiting)) {
    return null
  }

  return (
    <div
      className={`pwa-prompt ${isExiting ? 'pwa-exit' : 'pwa-enter'} fixed bottom-[20px] right-[12px] z-[70] w-[268px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[20px] border bg-white shadow-[0_24px_54px_rgba(26,46,31,0.22),0_10px_24px_rgba(61,122,95,0.14)]`}
      style={{ borderColor: 'rgba(61,122,95,0.15)' }}
      aria-live="polite"
    >
      <div className="accent-bar h-full w-1 bg-[linear-gradient(180deg,#4E9B76_0%,#3D7A5F_45%,#2F614B_100%)] absolute inset-y-0 left-0" />
      <div className="body relative bg-[linear-gradient(180deg,#ffffff_0%,#f9fcfa_100%)] pl-4 pr-4 py-4">
        <div className="header flex items-start gap-3">
          <Image
            src="/icon-192.png"
            alt="Zmeurel OS"
            width={38}
            height={38}
            className="h-[38px] w-[38px] rounded-xl border border-black/5"
          />
          <div className="min-w-0 flex-1">
            <p className="title text-[14px] leading-5 font-[750] text-[#1a2e1f]">Zmeurel OS pe ecranul tău</p>
            <p className="sub mt-0.5 text-[12px] leading-[1.35] text-[#44624c]">
              Deschide instant · Merge și fără net
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] text-[#5a7463] transition hover:bg-[#e8f5ee] active:scale-[0.97]"
            aria-label="Închide promptul de instalare"
          >
            ✕
          </button>
        </div>

        <div className="pills mt-3 flex flex-wrap gap-2">
          {['⚡ Instant', '📴 Offline', '🔔 Notificări', '🆓 Gratuit'].map((item) => (
            <span
              key={item}
              className="rounded-full border px-2.5 py-1 text-[11px] font-semibold text-[#365843]"
              style={{ borderColor: 'rgba(61,122,95,0.14)', backgroundColor: '#e8f5ee' }}
            >
              {item}
            </span>
          ))}
        </div>

        <div className="actions mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="flex-1 rounded-[14px] bg-[#3D7A5F] px-3 py-2.5 text-[13px] font-bold text-white shadow-[0_12px_24px_rgba(61,122,95,0.24)] transition hover:bg-[#356a52] active:scale-[0.98]"
          >
            📲 Instalează
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-[14px] border px-3 py-2.5 text-[13px] font-semibold text-[#365843] transition hover:bg-[#f4fbf7] active:scale-[0.98]"
            style={{ borderColor: 'rgba(61,122,95,0.15)' }}
          >
            Amână
          </button>
        </div>

        <button
          type="button"
          onClick={handleNeverShow}
          className="mt-3 text-left text-[12px] font-semibold text-[#5a7463] underline underline-offset-2"
        >
          Nu mai arăta
        </button>
      </div>
    </div>
  )
}
