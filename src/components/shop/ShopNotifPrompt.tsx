'use client'

import { useState } from 'react'

import { usePushSubscription } from '@/components/notifications/usePushSubscription'
import { markAsked, markNotificationPromptSession } from '@/lib/shop/useNotificationPrompt'

type ShopNotifPromptProps = {
  onClose: () => void
}

export function ShopNotifPrompt({ onClose }: ShopNotifPromptProps) {
  const { subscribe } = usePushSubscription()
  const [loading, setLoading] = useState(false)

  const handleEnable = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      onClose()
      return
    }

    setLoading(true)
    markAsked()
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        await subscribe()
      }
    } finally {
      setLoading(false)
      onClose()
    }
  }

  const handleLater = () => {
    markNotificationPromptSession()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[75] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div className="shop-notif-prompt relative mx-auto min-h-[35dvh] w-full max-w-[420px] overflow-hidden rounded-t-[22px] border border-[#f3dad4] bg-white shadow-[0_-22px_54px_rgba(232,93,93,0.18),0_-8px_22px_rgba(49,46,63,0.08)] animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex min-h-[35dvh] flex-col justify-center bg-[linear-gradient(180deg,#fffafa_0%,#fff5f5_100%)] px-5 py-5">
          <div className="mx-auto mb-5 h-[3px] w-8 rounded-full bg-[#d6d3d1]" aria-hidden />

          <div className="flex items-start gap-3">
            <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-[#e85d5d] text-[24px] shadow-[0_12px_26px_rgba(232,93,93,0.28)]">
              <span aria-hidden>🌿</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2
                className="text-[18px] font-semibold leading-6 tracking-[-0.01em] text-[#312E3F]"
                style={{ fontFamily: 'var(--font-comanda-display), inherit' }}
              >
                Vești din plantație, direct pe telefon
              </h2>
              <p className="mt-1 text-[13px] leading-[1.45] text-[#6b5f63]">
                Când avem zmeură sau livrăm în zona ta.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void handleEnable()}
              disabled={loading}
              className="w-full rounded-2xl bg-[#e85d5d] px-4 py-3 text-[14px] font-bold text-white shadow-[0_14px_26px_rgba(232,93,93,0.28)] transition hover:bg-[#dc5454] active:scale-[0.98] disabled:opacity-70"
            >
              {loading ? 'Se deschide…' : '🍓 Da, vreau să fiu anunțat'}
            </button>
            <button
              type="button"
              onClick={handleLater}
              disabled={loading}
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-[#8a7478] transition hover:bg-[#fff0f0] active:scale-[0.98] disabled:opacity-70"
            >
              Mai târziu
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
