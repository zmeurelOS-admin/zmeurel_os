'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ASSOCIATION_SHOP_BASE } from '@/lib/shop/association-routes'
import { gustaBrandColors } from '@/lib/shop/association/brand-tokens'
import { cn } from '@/lib/utils'

/** Cheie localStorage — banner informativ (fără cookies non-esențiale în acest magazin). */
export const GUSTA_COOKIE_CONSENT_KEY = 'gusta_cookie_consent'

const COOKIES_PATH = `${ASSOCIATION_SHOP_BASE}/cookies`

/* DRAFT_LEGAL_REVIEW — banner cookies magazin asociație */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const v = window.localStorage.getItem(GUSTA_COOKIE_CONSENT_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- citire localStorage după mount (client-only)
      setVisible(v !== 'accepted')
    } catch {
      setVisible(true)
    }
  }, [])

  const accept = () => {
    try {
      window.localStorage.setItem(GUSTA_COOKIE_CONSENT_KEY, 'accepted')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className={cn(
        'assoc-body pointer-events-auto fixed left-3 right-3 z-[190] max-md:bottom-[calc(70px+env(safe-area-inset-bottom,0px)+10px)]',
        'md:bottom-6 md:left-auto md:right-6 md:max-w-lg',
      )}
      role="dialog"
      aria-label="Informare cookies"
    >
      <div className="rounded-t-[16px] border border-black/10 bg-white px-4 py-4 shadow-[0_-12px_48px_rgba(0,0,0,0.12)] md:rounded-2xl md:px-5 md:py-5">
        <p className="text-[13px] leading-relaxed text-[#3D4543] md:text-sm">
          Acest site folosește cookies tehnice esențiale pentru funcționare. Nu folosim cookies de marketing sau
          tracking.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={accept}
            className="assoc-heading min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-105"
            style={{ backgroundColor: gustaBrandColors.primary }}
          >
            Accept
          </button>
          <Link
            href={COOKIES_PATH}
            className="text-sm font-semibold underline underline-offset-2"
            style={{ color: gustaBrandColors.primary }}
          >
            Detalii
          </Link>
        </div>
      </div>
    </div>
  )
}
