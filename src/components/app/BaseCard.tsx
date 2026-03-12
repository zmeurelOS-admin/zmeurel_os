'use client'

import { EntityCard } from '@/components/ui/app-card'
import { cn } from '@/lib/utils'

interface BaseCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function BaseCard({ children, className, onClick }: BaseCardProps) {
  return (
    <EntityCard
      className={cn(
        'relative min-h-[168px] overflow-hidden rounded-2xl sm:min-h-[188px]',
        onClick ? 'cursor-pointer' : '',
        className
      )}
      onClick={onClick}
    >
      {children}
    </EntityCard>
  )
}

interface CardColumnProps {
  children: React.ReactNode
  className?: string
}

export function CardLeftColumn({ children, className }: CardColumnProps) {
  return <div className={cn('min-w-0 space-y-4', className)}>{children}</div>
}

export function CardRightColumn({ children, className }: CardColumnProps) {
  return <div className={cn('min-w-0 space-y-4', className)}>{children}</div>
}
