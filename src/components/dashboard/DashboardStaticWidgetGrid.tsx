'use client'

import { useMemo, type ReactNode } from 'react'

import {
  DASHBOARD_GRID_COLS,
  DASHBOARD_GRID_MARGIN,
  DASHBOARD_GRID_ROW_HEIGHT,
} from '@/lib/dashboard/grid-config'
import { resolveDashboardGridDisplayPositions } from '@/lib/dashboard/grid-compact'
import type { DashboardWidgetLayoutItem } from '@/lib/dashboard/layout'
import { cn } from '@/lib/utils'

type DashboardStaticWidgetGridProps = {
  widgets: DashboardWidgetLayoutItem[]
  className?: string
  loadingPlaceholder?: boolean
  children: (widget: DashboardWidgetLayoutItem) => ReactNode
}

export function DashboardStaticWidgetGrid({
  widgets,
  className,
  loadingPlaceholder = false,
  children,
}: DashboardStaticWidgetGridProps) {
  const displayWidgets = useMemo(() => resolveDashboardGridDisplayPositions(widgets), [widgets])
  const [marginX, marginY] = DASHBOARD_GRID_MARGIN

  return (
    <div
      className={cn('dashboard-static-widget-grid min-h-[1px]', className)}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${DASHBOARD_GRID_COLS}, minmax(0, 1fr))`,
        gridAutoRows: `${DASHBOARD_GRID_ROW_HEIGHT}px`,
        columnGap: marginX,
        rowGap: marginY,
      }}
    >
      {displayWidgets.map((widget) => (
        <div
          key={widget.id}
          className="h-full min-h-0"
          style={{
            gridColumn: `${widget.x + 1} / span ${widget.w}`,
            gridRow: `${widget.y + 1} / span ${widget.h}`,
          }}
        >
          {loadingPlaceholder ? (
            <div
              className="h-full min-h-[120px] animate-pulse rounded-[22px] bg-[var(--surface-card-muted)]"
              aria-hidden
            />
          ) : (
            children(widget)
          )}
        </div>
      ))}
    </div>
  )
}
