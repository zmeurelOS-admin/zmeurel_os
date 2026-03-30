'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AiBottomSheet } from '@/components/ai/AiBottomSheet'

const AI_FAB_TOOLTIP_SESSION_KEY = 'zmeurel-ai-fab-tooltip-seen'

export default function AiFab() {
  const [open, setOpen] = useState(false)
  const [tooltipState, setTooltipState] = useState<'hidden' | 'visible' | 'closing'>(() => {
    if (typeof window === 'undefined') return 'hidden'

    try {
      return window.sessionStorage.getItem(AI_FAB_TOOLTIP_SESSION_KEY) === '1' ? 'hidden' : 'visible'
    } catch {
      return 'hidden'
    }
  })
  const closingTimerRef = useRef<number | null>(null)

  const dismissTooltip = useCallback((instant = false) => {
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(AI_FAB_TOOLTIP_SESSION_KEY, '1')
      } catch {
        // ignore sessionStorage failures
      }
    }

    if (closingTimerRef.current) {
      window.clearTimeout(closingTimerRef.current)
      closingTimerRef.current = null
    }

    if (instant) {
      setTooltipState('hidden')
      return
    }

    setTooltipState((current) => (current === 'hidden' ? current : 'closing'))
    closingTimerRef.current = window.setTimeout(() => {
      setTooltipState('hidden')
      closingTimerRef.current = null
    }, 220)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || tooltipState !== 'visible') return

    const autoHideTimer = window.setTimeout(() => dismissTooltip(false), 4000)
    const handlePointerDown = () => dismissTooltip(true)

    window.addEventListener('pointerdown', handlePointerDown, true)

    return () => {
      window.clearTimeout(autoHideTimer)
      window.removeEventListener('pointerdown', handlePointerDown, true)
      if (closingTimerRef.current) {
        window.clearTimeout(closingTimerRef.current)
      }
    }
  }, [dismissTooltip, tooltipState])

  return (
    <>
      <div
        className="lg:hidden"
        style={{ position: 'fixed', bottom: 94, right: 14, zIndex: 42 }}
      >
        {tooltipState !== 'hidden' ? (
          <div
            className={`pointer-events-none absolute right-[calc(100%+10px)] top-1/2 min-w-max -translate-y-1/2 rounded-2xl border border-[var(--soft-success-border)] bg-[var(--agri-surface)] px-3 py-2 text-sm font-semibold text-[var(--agri-text)] shadow-lg transition-all duration-200 ${
              tooltipState === 'visible' ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0'
            }`}
          >
            Întreabă-mă orice 🌱
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative flex h-14 w-14 cursor-pointer flex-col items-center justify-center rounded-full border border-[var(--agri-border)] bg-[var(--brand-blue)] p-0 shadow-[var(--agri-shadow)] dark:border-[var(--agri-border)] dark:bg-[var(--brand-blue)]"
          aria-label="Asistent AI Zmeurel"
        >
          <Image
            src="/icons/icon.svg"
            alt="Zmeurel AI"
            width={28}
            height={28}
            className="rounded-full"
          />
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
            AI
          </span>
        </button>
      </div>

      <AiBottomSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
