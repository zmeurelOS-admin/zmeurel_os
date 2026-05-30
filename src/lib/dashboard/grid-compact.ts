import type { DashboardWidgetLayoutItem } from '@/lib/dashboard/layout'

import { DASHBOARD_GRID_COLS } from './grid-config'

export interface DashboardGridLayoutItemCompact {
  i: string
  x: number
  y: number
  w: number
  h: number
  static?: boolean
}

function collides(left: DashboardGridLayoutItemCompact, right: DashboardGridLayoutItemCompact): boolean {
  if (left.i === right.i) return false
  if (left.x + left.w <= right.x) return false
  if (left.x >= right.x + right.w) return false
  if (left.y + left.h <= right.y) return false
  if (left.y >= right.y + right.h) return false
  return true
}

function getFirstCollision(
  layout: DashboardGridLayoutItemCompact[],
  item: DashboardGridLayoutItemCompact
): DashboardGridLayoutItemCompact | undefined {
  for (const candidate of layout) {
    if (collides(candidate, item)) return candidate
  }
  return undefined
}

function sortLayoutItemsByRowCol(layout: DashboardGridLayoutItemCompact[]): DashboardGridLayoutItemCompact[] {
  return [...layout].sort((left, right) => {
    if (left.y > right.y || (left.y === right.y && left.x > right.x)) return 1
    if (left.y < right.y || (left.y === right.y && left.x < right.x)) return -1
    return 0
  })
}

/**
 * Mirrors react-grid-layout `compactType="vertical"` for a fixed subset of items.
 * Used for static view rendering so positions match RGL without loading the library.
 */
export function compactLayoutVertical(
  layout: DashboardGridLayoutItemCompact[],
  cols: number = DASHBOARD_GRID_COLS
): DashboardGridLayoutItemCompact[] {
  void cols
  const sorted = sortLayoutItemsByRowCol(layout)
  const compareWith: DashboardGridLayoutItemCompact[] = []
  const compactedById = new Map<string, DashboardGridLayoutItemCompact>()

  for (const item of sorted) {
    const next: DashboardGridLayoutItemCompact = { ...item }

    if (!next.static) {
      while (next.y > 0 && !getFirstCollision(compareWith, next)) {
        next.y -= 1
      }
      while (getFirstCollision(compareWith, next)) {
        next.y += 1
      }
    }

    compareWith.push(next)
    compactedById.set(next.i, next)
  }

  return layout.map((item) => compactedById.get(item.i) ?? item)
}

export function resolveDashboardGridDisplayPositions(
  widgets: DashboardWidgetLayoutItem[],
  cols: number = DASHBOARD_GRID_COLS
): DashboardWidgetLayoutItem[] {
  if (widgets.length === 0) return widgets

  const compacted = compactLayoutVertical(
    widgets.map((widget) => ({
      i: widget.id,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
      static: widget.static,
    })),
    cols
  )

  const byId = new Map(compacted.map((item) => [item.i, item]))

  return widgets.map((widget) => {
    const resolved = byId.get(widget.id)
    if (!resolved) return widget
    return {
      ...widget,
      x: resolved.x,
      y: resolved.y,
      w: resolved.w,
      h: resolved.h,
    }
  })
}
