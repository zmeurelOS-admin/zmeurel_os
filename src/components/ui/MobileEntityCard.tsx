'use client'

import type React from 'react'
import { forwardRef } from 'react'

import { ListCard } from '@/components/ui/app-card'
import { cn } from '@/lib/utils'

type MobileEntityCardProps = {
  title: React.ReactNode
  value: React.ReactNode
  secondary?: React.ReactNode
  status?: React.ReactNode
  onClick?: () => void
  isExpanded?: boolean
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export const MobileEntityCard = forwardRef<HTMLDivElement, MobileEntityCardProps>(function MobileEntityCard(
  { title, value, secondary, status, onClick, isExpanded = false, children, className, style },
  ref
) {
  return (
    <ListCard
      ref={ref}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      style={style}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        'w-full p-4 text-left',
        onClick ? 'cursor-pointer transition-transform duration-120 active:scale-[0.99]' : '',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">
            {title}
          </div>
          <div className="mt-1 text-2xl font-bold leading-tight text-[var(--agri-text)]">{value}</div>
          {secondary ? (
            <div className="mt-1 text-xs font-medium text-[var(--agri-text-muted)]">{secondary}</div>
          ) : null}
        </div>

        {status ? <div className="shrink-0">{status}</div> : null}
      </div>

      {children ? (
        <div
          className={cn(
            'mt-3 border-t border-[var(--surface-divider)] pt-3',
            isExpanded ? 'block' : 'hidden'
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      ) : null}
    </ListCard>
  )
})
