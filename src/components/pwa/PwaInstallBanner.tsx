'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Download, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const PERMANENT_DISMISS_KEY = 'zmeurel:pwa-install:dismissed'
const POSTPONE_UNTIL_KEY = 'zmeurel:pwa-install:postpone-until'
const POSTPONE_DAYS = 4

function isIosDevice(userAgent: string, maxTouchPoints: number) {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Mac/.test(userAgent) && maxTouchPoints > 1)
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

function isPermanentlyDismissed() {
  try {
    return window.localStorage.getItem(PERMANENT_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function isPostponed() {
  try {
    const raw = window.localStorage.getItem(POSTPONE_UNTIL_KEY)
    const until = raw ? Number(raw) : 0
    return Number.isFinite(until) && until > Date.now()
  } catch {
    return false
  }
}

function setPostponeWindow() {
  try {
    window.localStorage.setItem(POSTPONE_UNTIL_KEY, String(Date.now() + POSTPONE_DAYS * 24 * 60 * 60 * 1000))
  } catch {
    // no-op
  }
}

function setPermanentDismiss() {
  try {
    window.localStorage.setItem(PERMANENT_DISMISS_KEY, '1')
  } catch {
    // no-op
  }
}

function isDashboardWorkspacePath(pathname: string) {
  return !(
    pathname === '/' ||
    pathname === '/start' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/termeni' ||
    pathname === '/confidentialitate' ||
    pathname === '/ajutor' ||
    pathname.startsWith('/magazin') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/update-password')
  )
}

export function PwaInstallBanner() {
  const pathname = usePathname()
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [mounted, setMounted] = useState(false)
  const [promptAvailable, setPromptAvailable] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [sessionHidden, setSessionHidden] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (typeof window === 'undefined') return

    const standalone = isStandaloneMode()
    const ios = isIosDevice(window.navigator.userAgent, window.navigator.maxTouchPoints ?? 0)

    setInstalled(standalone)
    setIsIos(ios)

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent
      promptEvent.preventDefault()
      deferredPromptRef.current = promptEvent
      setPromptAvailable(true)
      setSessionHidden(false)
    }

    const handleAppInstalled = () => {
      deferredPromptRef.current = null
      setPromptAvailable(false)
      setInstalled(true)
      setSessionHidden(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const shouldSuppress = useMemo(() => {
    if (!mounted || installed) return true
    if (sessionHidden) return true
    if (typeof window === 'undefined') return true
    if (isPermanentlyDismissed()) return true
    if (isPostponed()) return true
    return false
  }, [installed, mounted, sessionHidden])

  const mode = useMemo<'install' | 'ios' | null>(() => {
    if (shouldSuppress) return null
    if (promptAvailable && deferredPromptRef.current) return 'install'
    if (isIos) return 'ios'
    return null
  }, [isIos, promptAvailable, shouldSuppress])

  const bottomInset = useMemo(() => {
    if (pathname.startsWith('/magazin/asociatie')) {
      return 'calc(70px + env(safe-area-inset-bottom, 0px) + 12px)'
    }

    if (isDashboardWorkspacePath(pathname)) {
      return 'calc(var(--app-nav-clearance) + 12px)'
    }

    return 'calc(env(safe-area-inset-bottom, 0px) + 12px)'
  }, [pathname])

  const handleInstall = async () => {
    const promptEvent = deferredPromptRef.current
    if (!promptEvent || installing) return

    setInstalling(true)

    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      deferredPromptRef.current = null
      setPromptAvailable(false)
      setSessionHidden(true)

      if (choice.outcome !== 'accepted') {
        setPostponeWindow()
      }
    } finally {
      setInstalling(false)
    }
  }

  const handlePostpone = () => {
    setPostponeWindow()
    setSessionHidden(true)
  }

  const handlePermanentDismiss = () => {
    setPermanentDismiss()
    setSessionHidden(true)
  }

  if (!mounted || !mode) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 px-3 md:hidden"
      style={{ bottom: bottomInset }}
      aria-live="polite"
    >
      <section
        className={cn(
          'pointer-events-auto mx-auto max-w-[430px] overflow-hidden rounded-[24px] border bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[0_6px_24px_rgba(120,100,70,0.14),0_2px_8px_rgba(120,100,70,0.1)]',
          'border-[color:color-mix(in_srgb,var(--border-default)_78%,transparent)]'
        )}
      >
        <div className="flex items-start gap-3 p-4 pb-3">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#F8F7F5,#F0EFEC)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
            <Image src="/icons/icon.svg" alt="" width={24} height={24} aria-hidden className="h-6 w-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] leading-5 [font-weight:700]">Instalează aplicația</p>
                <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
                  Acces rapid, ca o aplicație nativă
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSessionHidden(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--text-secondary)] transition active:scale-[0.985]"
                aria-label="Închide bannerul de instalare"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {mode === 'ios' ? (
              <p className="mt-3 text-[13px] leading-5 text-[var(--text-secondary)]">
                Pentru instalare: deschide în Safari, apasă Share și apoi Add to Home Screen.
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[var(--divider)] bg-[color:color-mix(in_srgb,var(--surface-card-muted)_28%,var(--surface-card))] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.9rem)] pt-3">
          <div className="flex items-center gap-2">
            {mode === 'install' ? (
              <Button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                className="h-11 flex-1 bg-[var(--agri-primary)] text-white shadow-[0_4px_20px_rgba(13,155,92,0.2),0_1px_3px_rgba(13,155,92,0.15)] hover:bg-[var(--agri-primary)]/95"
              >
                <Download className="h-4 w-4" />
                {installing ? 'Se deschide...' : 'Instalează'}
              </Button>
            ) : null}

            <Button type="button" variant="outline" onClick={handlePostpone} className="h-11 shrink-0 px-4">
              Amină
            </Button>
          </div>

          <button
            type="button"
            onClick={handlePermanentDismiss}
            className="mt-3 text-xs font-semibold text-[var(--text-secondary)] underline-offset-4 transition hover:underline"
          >
            Nu mai arăta
          </button>
        </div>
      </section>
    </div>
  )
}
