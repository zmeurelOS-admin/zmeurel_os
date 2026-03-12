import type { ReactNode } from 'react'

import { AppCardContent, AppCardHeader, InfoCard } from '@/components/ui/app-card'
import { cn } from '@/lib/utils'

interface DashboardCardProps {
  children: ReactNode
  title?: ReactNode
  rightSlot?: ReactNode
  onClick?: () => void
  className?: string
  contentClassName?: string
}

export function DashboardCard({
  children,
  title,
  rightSlot,
  onClick,
  className,
  contentClassName,
}: DashboardCardProps) {
  const interactive = typeof onClick === 'function'

  return (
    <InfoCard
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onClick?.()
            }
          : undefined
      }
      className={cn(
        'border-[var(--agri-border)] bg-white duration-150',
        interactive ? 'cursor-pointer active:scale-[0.98] md:hover:shadow-md' : '',
        className
      )}
    >
      {title || rightSlot ? (
        <AppCardHeader className="mb-2">
          <h3 className="text-[var(--agri-text-muted)]">{title}</h3>
          {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
        </AppCardHeader>
      ) : null}
      <AppCardContent className={cn('space-y-1.5', contentClassName)}>{children}</AppCardContent>
    </InfoCard>
  )
}
