import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'

type StatTrend = 'up' | 'down' | 'neutral'

interface StatRowProps {
  label: ReactNode
  value: ReactNode
  trend?: StatTrend
  className?: string
  valueClassName?: string
}

const trendMap: Record<StatTrend, { Icon: typeof ArrowUpRight; className: string }> = {
  up: { Icon: ArrowUpRight, className: 'text-emerald-600' },
  down: { Icon: ArrowDownRight, className: 'text-red-600' },
  neutral: { Icon: ArrowRight, className: 'text-[var(--agri-text-muted)]' },
}

export function StatRow({ label, value, trend, className, valueClassName }: StatRowProps) {
  const trendConfig = trend ? trendMap[trend] : null

  return (
    <div className={cn('rounded-lg border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] p-2', className)}>
      <span className="block truncate text-sm text-[var(--agri-text-muted)]">{label}</span>
      <span className={cn('mt-0.5 inline-flex items-center gap-1 text-lg font-semibold leading-tight text-[var(--agri-text)]', valueClassName)}>
        <span>{value}</span>
        {trendConfig ? <trendConfig.Icon className={cn('h-3.5 w-3.5', trendConfig.className)} /> : null}
      </span>
    </div>
  )
}
