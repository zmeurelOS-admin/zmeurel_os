import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface DashboardGridProps {
  children: ReactNode
  className?: string
}

export function DashboardGrid({ children, className }: DashboardGridProps) {
  return <div className={cn('grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4', className)}>{children}</div>
}
