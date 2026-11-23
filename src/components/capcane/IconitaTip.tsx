import type { TipCapcana } from '@/lib/capcane'
import { kitText } from '@/components/kit'
import { cn } from '@/lib/utils'

const EMOJI: Record<TipCapcana, string> = {
  drosophila: '🪰',
  lipicioasa_galbena: '🟨',
  feromoni: '🦋',
  alta: '•••',
}

/** Cercul din stânga rândului: tipul capcanei (emoji), pe tonul stării. */
export function IconitaTip({ tip, ton = 'primary', className }: { tip: TipCapcana; ton?: 'primary' | 'warning' | 'neutral'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full',
        kitText.card,
        ton === 'primary' && 'bg-primary-soft',
        ton === 'warning' && 'bg-warning-bg',
        ton === 'neutral' && 'bg-surface-muted',
        className,
      )}
    >
      {EMOJI[tip]}
    </span>
  )
}

export function emojiTip(tip: TipCapcana): string {
  return EMOJI[tip]
}
