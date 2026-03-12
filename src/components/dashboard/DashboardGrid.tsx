import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface DashboardGridProps {
  children: ReactNode
  className?: string
}

export function DashboardGrid({ children, className }: DashboardGridProps) {
  return <div className={cn('grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3', className)}>{children}</div>
}
