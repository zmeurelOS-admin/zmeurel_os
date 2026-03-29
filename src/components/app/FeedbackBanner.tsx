'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

const BANNER_DISMISSED_KEY = 'zmeurel_feedback_banner_dismissed'

function hasSubmittedPhone(tenantId: string | null): boolean {
  if (typeof window === 'undefined' || !tenantId) return false
  try {
    return window.localStorage.getItem(`zmeurel_phone_submitted_${tenantId}`) === 'true'
  } catch {
    return false
  }
}

function isBannerDismissed(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(BANNER_DISMISSED_KEY) === 'true'
  } catch {
    return true
  }
}

function dismissBanner(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BANNER_DISMISSED_KEY, 'true')
  } catch {
    // ignore
  }
}

function shouldShowBanner(tenantId: string | null | undefined): boolean {
  if (isBannerDismissed()) return false
  if (hasSubmittedPhone(tenantId ?? null)) return false
  return true
}

const WHATSAPP_URL =
  'https://wa.me/40752953048?text=Salut%20Andrei%2C%20testez%20Zmeurel%20si%20vreau%20sa%20dau%20feedback'

interface FeedbackBannerProps {
  tenantId?: string | null
}

export function FeedbackBanner({ tenantId }: FeedbackBannerProps) {
  const [visible, setVisible] = useState(() => shouldShowBanner(tenantId))

  if (!visible) return null

  function handleDismiss() {
    dismissBanner()
    setVisible(false)
  }

  return (
    <div
      role="banner"
      className="relative mb-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--soft-success-border)] bg-[var(--soft-success-bg)] px-4 py-3 text-sm text-[var(--soft-success-text)]"
    >
      <span className="flex-1 leading-snug">
        Ajută-ne să îmbunătățim Zmeurel — 5 minute cu fondatorul
      </span>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-lg border border-[var(--soft-success-border)] bg-[var(--agri-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--soft-success-text)] transition hover:bg-[var(--agri-surface-muted)]"
      >
        Scrie pe WhatsApp →
      </a>
      <button
        type="button"
        aria-label="Închide banner"
        onClick={handleDismiss}
        className="shrink-0 rounded-full p-1 text-[var(--soft-success-text)] transition hover:bg-[var(--agri-surface-muted)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
