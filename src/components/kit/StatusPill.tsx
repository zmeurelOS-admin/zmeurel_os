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
}

/** Pastilă de status. Nu e apăsabilă; tonul spune rolul, nu numele statusului. */
export function StatusPill({ tone = 'neutral', icon, children, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 font-bold [&_svg]:size-3.5',
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
