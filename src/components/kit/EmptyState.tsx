import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitText } from './text'

export interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** De obicei un buton (`Button variant="primary" size="touch"`). */
  action?: ReactNode
  className?: string
}

/** Stare goală: ce lipsește și, dacă există, ce poți face mai departe. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {icon ? (
        <div className="mb-3 text-fg-muted [&_svg]:size-10" aria-hidden>
          {icon}
        </div>
      ) : null}
      <p className={cn('font-extrabold text-fg', kitText.card)}>{title}</p>
      {description ? <p className={cn('mt-1 max-w-xs text-fg-muted', kitText.secondary)}>{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
