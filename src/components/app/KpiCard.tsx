'use client'

import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import { InfoCard } from '@/components/ui/app-card'
import { getStatusToneTokens, type StatusTone } from '@/lib/ui/theme'
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
    tone: 'success' as StatusTone,
  },
  down: {
    label: 'Trend descrescator',
    icon: ArrowDownRight,
    tone: 'danger' as StatusTone,
  },
  neutral: {
    label: 'Trend stabil',
    icon: ArrowRight,
    tone: 'neutral' as StatusTone,
  },
} as const

function getToneClass(tone: StatusTone): string {
  const tokens = getStatusToneTokens(tone)
  return `border border-[var(${tokens.border})] bg-[var(${tokens.bg})] text-[var(${tokens.text})]`
}

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
    <InfoCard className={cn('min-h-[148px] lg:min-h-[110px]', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2.5 lg:flex lg:flex-col lg:gap-1 lg:space-y-0">
          <p className="text-[13px] leading-snug tracking-[-0.01em] text-[var(--text-secondary)] [font-weight:650]">
            {title}
          </p>
          <p className="text-[1.15rem] leading-none tracking-[-0.02em] text-[var(--text-primary)] sm:text-[1.4rem] lg:text-xl lg:[font-weight:750]">
            {value}
          </p>
          <span
            aria-label={trendConfig.label}
            className={cn(
              'hidden h-6 items-center gap-1 rounded-md px-2 text-[10px] font-semibold tracking-wide lg:inline-flex',
              getToneClass(trendConfig.tone)
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {trend === 'up' ? 'Up' : trend === 'down' ? 'Down' : 'Stabil'}
          </span>
          {subtitle ? <p className="text-[13px] text-[var(--text-secondary)] lg:text-xs">{subtitle}</p> : null}
        </div>

        <div className="ml-0 flex flex-shrink-0 flex-col items-end gap-2 lg:ml-2">
          {icon ? (
            <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-primary)]">
              {icon}
            </div>
          ) : null}
          <span
            aria-label={trendConfig.label}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-semibold tracking-wide lg:hidden',
              getToneClass(trendConfig.tone)
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
