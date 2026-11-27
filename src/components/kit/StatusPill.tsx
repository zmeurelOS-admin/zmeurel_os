import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitText } from './text'

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: 'border-neutral-border bg-neutral-bg text-neutral-text',
  info: 'border-info-border bg-info-bg text-info-text',
  success: 'border-success-border bg-success-bg text-success-text',
  warning: 'border-warning-border bg-warning-bg text-warning-text',
  danger: 'border-danger-border bg-danger-bg text-danger-text',
}

export interface StatusPillProps {
  tone?: StatusTone
  /** Iconiță înaintea textului (ex. steagul de la „Prioritară”). */
  icon?: ReactNode
  children: ReactNode
  className?: string
  /**
   * Textul aliniat la stânga când trece pe mai multe rânduri (promptul 33: eticheta stadiului de pe cardul parcelei).
   * Din promptul 34 (§9), orice pastilă care nu încape trece pe rândul următor, nu iese din chenar.
   */
  wrap?: boolean
}

/** Pastilă de status. Nu e apăsabilă; tonul spune rolul, nu numele statusului. */
export function StatusPill({ tone = 'neutral', icon, children, className, wrap = false }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-3 font-bold [&_svg]:size-3.5',
        'min-h-[30px] max-w-full py-1 leading-tight',
        wrap && 'text-left',
        kitText.helper,
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
