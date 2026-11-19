import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { kitText } from './text'

export interface SuccessScreenAction {
  label: ReactNode
  onClick: () => void
  icon?: ReactNode
}

export interface SuccessScreenProps {
  title: ReactNode
  /** Ce s-a salvat, pe scurt (ex. „Ana Lungu · 27,35 kg”). */
  description?: ReactNode
  /** Înlocuiește bifa. */
  icon?: ReactNode
  primaryAction: SuccessScreenAction
  secondaryAction?: SuccessScreenAction
  className?: string
}

/** Ecranul de după o salvare reușită: ce s-a salvat și ce urmează. */
export function SuccessScreen({ title, description, icon, primaryAction, secondaryAction, className }: SuccessScreenProps) {
  return (
    <div
      role="status"
      className={cn('flex min-h-full flex-col items-center justify-center gap-4 py-10 text-center', className)}
    >
      <div
        className="flex size-24 items-center justify-center rounded-full bg-success-bg text-success-text [&_svg]:size-12"
        aria-hidden
      >
        {icon ?? <Check strokeWidth={2.6} />}
      </div>
      <h2 className={cn('font-extrabold text-fg', kitText.screen)}>{title}</h2>
      {description ? <p className={cn('max-w-xs text-fg-muted', kitText.base)}>{description}</p> : null}
      <div className="mt-4 flex w-full max-w-sm flex-col gap-2.5">
        <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={primaryAction.onClick}>
          {primaryAction.icon}
          {primaryAction.label}
        </Button>
        {secondaryAction ? (
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={secondaryAction.onClick}>
            {secondaryAction.icon}
            {secondaryAction.label}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
