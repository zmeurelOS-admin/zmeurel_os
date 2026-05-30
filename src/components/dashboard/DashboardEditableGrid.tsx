'use client'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import GridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import type { ReactNode } from 'react'

import {
  DASHBOARD_GRID_COLS,
  DASHBOARD_GRID_MARGIN,
  DASHBOARD_GRID_ROW_HEIGHT,
} from '@/lib/dashboard/grid-config'
import { toReactGridLayout, type DashboardWidgetId, type DashboardWidgetLayoutItem } from '@/lib/dashboard/layout'

const DashboardGridLayout = WidthProvider(GridLayout)

type DashboardEditableGridProps = {
  widgets: DashboardWidgetLayoutItem[]
  className?: string
  onLayoutChange: (nextLayout: readonly { i: string; x: number; y: number; w: number; h: number }[]) => void
  children: (widgetId: DashboardWidgetId) => ReactNode
}

export function DashboardEditableGrid({
  widgets,
  className,
  onLayoutChange,
  children,
}: DashboardEditableGridProps) {
  return (
    <DashboardGridLayout
      className={className}
      layout={toReactGridLayout(widgets)}
      cols={DASHBOARD_GRID_COLS}
      rowHeight={DASHBOARD_GRID_ROW_HEIGHT}
      margin={[...DASHBOARD_GRID_MARGIN]}
      containerPadding={[0, 0]}
      isDraggable
      isResizable
      compactType="vertical"
      useCSSTransforms
      draggableHandle=".dashboard-widget-handle"
      onLayoutChange={onLayoutChange}
    >
      {widgets.map((widget) => (
        <div key={widget.id} className="h-full">
          {children(widget.id)}
        </div>
      ))}
    </DashboardGridLayout>
  )
}
