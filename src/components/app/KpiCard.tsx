'use client'

import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import { InfoCard } from '@/components/ui/app-card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: ReactNode
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: ReactNode
  className?: string
}

const trendMap = {
  up: {
    label: 'Trend crescator',
    icon: ArrowUpRight,
    className: 'bg-[var(--soft-success-bg)] text-[var(--soft-success-text)]',
  },
  down: {
    label: 'Trend descrescator',
    icon: ArrowDownRight,
    className: 'bg-[var(--soft-danger-bg)] text-[var(--soft-danger-text)]',
  },
  neutral: {
    label: 'Trend stabil',
    icon: ArrowRight,
    className: 'bg-[var(--agri-surface-muted)] text-[var(--agri-text)]',
  },
} as const

export function KpiCard({
  title,
  value,
  subtitle,
  trend = 'neutral',
  icon,
  className,
}: KpiCardProps) {
  const trendConfig = trendMap[trend]
  const TrendIcon = trendConfig.icon

  return (
    <InfoCard className={cn('min-h-[196px] lg:min-h-[110px]', className)}>
      <div className="flex justify-between items-start gap-3 lg:gap-3">
        <div className="min-w-0 space-y-3 lg:flex lg:flex-col lg:gap-1 lg:space-y-0">
          <p className="text-sm text-muted-foreground">
            {title}
          </p>
          <p className="text-base font-medium leading-none text-[var(--agri-text)] sm:text-2xl lg:text-xl lg:font-semibold">
            {value}
          </p>
          <span
            aria-label={trendConfig.label}
            className={cn(
              'hidden h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold lg:inline-flex',
              trendConfig.className
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {trend === 'up' ? 'Up' : trend === 'down' ? 'Down' : 'Stabil'}
          </span>
          {subtitle ? <p className="text-base font-medium text-[var(--agri-text)] lg:text-xs lg:font-medium lg:text-[var(--agri-text-muted)]">{subtitle}</p> : null}
        </div>

        <div className="ml-0 flex flex-shrink-0 flex-col items-end gap-2 lg:ml-2">
          {icon ? (
            <div className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] text-[var(--agri-text)]">
              {icon}
            </div>
          ) : null}
          <span
            aria-label={trendConfig.label}
            className={cn(
              'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold lg:hidden',
              trendConfig.className
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {trend === 'up' ? 'Up' : trend === 'down' ? 'Down' : 'Stabil'}
          </span>
        </div>
      </div>
    </InfoCard>
  )
}

export function KpiCardSkeleton() {
  return (
    <InfoCard className="animate-pulse">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>
    </InfoCard>
  )
}
