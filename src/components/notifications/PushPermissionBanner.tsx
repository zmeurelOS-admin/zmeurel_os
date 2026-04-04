'use client'

import { Bell } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

import { usePushSubscription } from '@/components/notifications/usePushSubscription'

const LS_FIRST_SEEN = 'zmeurel_app_first_seen'
const LS_DISMISS_UNTIL = 'zmeurel_push_prompt_dismissed_at'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 767px)').matches
}

export function PushPermissionBanner() {
  const { isSupported, isSubscribed, permission, subscribe, hasVapidKey } = usePushSubscription()
  const [visible, setVisible] = useState(false)

  const evaluate = useCallback(() => {
    if (typeof window === 'undefined') return false
    if (process.env.NODE_ENV !== 'production') return false
    if (!hasVapidKey || !isSupported) return false
    if (permission !== 'default') return false
    if (isSubscribed) return false

    const dismissRaw = localStorage.getItem(LS_DISMISS_UNTIL)
    if (dismissRaw) {
      const t = Number(dismissRaw)
      if (!Number.isNaN(t) && Date.now() - t < THIRTY_DAYS_MS) {
        return false
      }
    }

    let firstSeen = Number(localStorage.getItem(LS_FIRST_SEEN) || '0')
    if (!firstSeen) {
      firstSeen = Date.now()
      localStorage.setItem(LS_FIRST_SEEN, String(firstSeen))
    }

    const mobile = isMobileViewport()
    const afterThreeDays = Date.now() - firstSeen >= THREE_DAYS_MS
    return mobile || afterThreeDays
  }, [hasVapidKey, isSupported, permission, isSubscribed])

  useEffect(() => {
    setVisible(evaluate())
  }, [evaluate])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onResize = () => setVisible(evaluate())
    mq.addEventListener('change', onResize)
    return () => mq.removeEventListener('change', onResize)
  }, [evaluate])

  const onActivate = async () => {
    const ok = await subscribe()
    if (ok) {
      toast.success('Notificări activate! Vei primi alerte pe telefon când ai comenzi noi.')
      setVisible(false)
    } else {
      toast.error('Nu am putut activa notificările. Verifică permisiunile browserului.')
    }
  }

  const onDismiss = () => {
    localStorage.setItem(LS_DISMISS_UNTIL, String(Date.now()))
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className={cn(
        'sticky top-0 z-[45] border-b border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--primary)_10%,var(--surface-page))] px-[var(--shell-content-px)] py-3 sm:px-5',
        'md:top-[var(--safe-t)]',
      )}
      role="region"
      aria-label="Notificări push"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-card)] shadow-sm">
            <Bell className="h-5 w-5 text-[var(--primary)]" aria-hidden />
          </div>
          <p className="text-sm font-[650] leading-snug text-[var(--text-primary)]">
            Vrei să primești notificări pe telefon când ai comenzi noi?
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void onActivate()}
            className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-95"
          >
            Activează
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-card-muted)]"
          >
            Nu acum
          </button>
        </div>
      </div>
    </div>
  )
}
