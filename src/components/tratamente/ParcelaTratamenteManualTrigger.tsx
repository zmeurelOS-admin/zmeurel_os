'use client'

import { cn } from '@/lib/utils'
import { colors } from '@/lib/design-tokens'

export const TRATAMENTE_OPEN_MANUAL_EVENT = 'zmeurel-tratamente-open-manual'

export function dispatchOpenTratamenteManual() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TRATAMENTE_OPEN_MANUAL_EVENT))
}

export function ParcelaTratamenteManualTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => dispatchOpenTratamenteManual()}
      className={cn(
        'inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl px-3 text-xs font-bold',
        className,
      )}
      style={{ background: colors.greenLight, color: colors.primary }}
    >
      + Manual
    </button>
  )
}
