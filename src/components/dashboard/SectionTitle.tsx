import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SectionTitleProps {
  title: ReactNode
  subtitle?: ReactNode
  rightSlot?: ReactNode
  className?: string
}

export function SectionTitle({ title, subtitle, rightSlot, className }: SectionTitleProps) {
  return (
    <div className={cn('flex items-start justify-between gap-2', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[var(--agri-text)] sm:text-base">{title}</h2>
        {subtitle ? <p className="text-xs text-[var(--agri-text-muted)] sm:text-sm">{subtitle}</p> : null}
      </div>
      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
    </div>
  )
}

