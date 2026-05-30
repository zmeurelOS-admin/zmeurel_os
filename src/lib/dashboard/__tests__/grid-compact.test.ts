import { describe, expect, it } from 'vitest'
import { verticalCompactor } from 'react-grid-layout/core'

import { DEFAULT_DASHBOARD_LAYOUT, type DashboardWidgetLayoutItem } from '@/lib/dashboard/layout'
import { compactLayoutVertical, resolveDashboardGridDisplayPositions } from '@/lib/dashboard/grid-compact'
import { DASHBOARD_GRID_COLS } from '@/lib/dashboard/grid-config'

function toRglLayout(widgets: DashboardWidgetLayoutItem[]) {
  return widgets.map((widget) => ({
    i: widget.id,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    static: widget.static,
  }))
}

function pickCoreLayout(items: readonly { i: string; x: number; y: number; w: number; h: number }[]) {
  return items.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))
}

describe('grid-compact', () => {
  it('matches react-grid-layout verticalCompactor on default layout', () => {
    const input = toRglLayout(DEFAULT_DASHBOARD_LAYOUT.widgets.filter((widget) => widget.active))
    const ours = compactLayoutVertical(input, DASHBOARD_GRID_COLS)
    const rgl = verticalCompactor.compact(input, DASHBOARD_GRID_COLS)

    expect(pickCoreLayout(ours)).toEqual(pickCoreLayout(rgl))
  })

  it('matches RGL when view widgets exclude kpi-summary and sumar-venituri', () => {
    const viewWidgets = DEFAULT_DASHBOARD_LAYOUT.widgets.filter(
      (widget) =>
        widget.active && widget.id !== 'kpi-summary' && widget.id !== 'sumar-venituri'
    )
    const input = toRglLayout(viewWidgets)
    const ours = compactLayoutVertical(input, DASHBOARD_GRID_COLS)
    const rgl = verticalCompactor.compact(input, DASHBOARD_GRID_COLS)

    expect(pickCoreLayout(ours)).toEqual(pickCoreLayout(rgl))
    expect(ours.find((item) => item.i === 'comenzi-recente')?.y).toBe(0)
  })

  it('re-compacts legacy saved layouts with vertical gaps', () => {
    const gapped: DashboardWidgetLayoutItem[] = [
      { id: 'kpi-summary', x: 0, y: 0, w: 12, h: 4, active: true, static: true },
      { id: 'comenzi-recente', x: 0, y: 8, w: 7, h: 16, active: true },
      { id: 'activitati-planificate', x: 7, y: 8, w: 5, h: 4, active: true },
      { id: 'recoltari-recente', x: 7, y: 12, w: 5, h: 4, active: true },
      { id: 'stocuri-critice', x: 7, y: 16, w: 5, h: 4, active: true },
      { id: 'sumar-venituri', x: 7, y: 20, w: 5, h: 4, active: true },
    ]

    const resolved = resolveDashboardGridDisplayPositions(
      gapped.filter((widget) => widget.id !== 'kpi-summary' && widget.id !== 'sumar-venituri')
    )
    const rgl = verticalCompactor.compact(
      toRglLayout(
        gapped.filter((widget) => widget.id !== 'kpi-summary' && widget.id !== 'sumar-venituri')
      ),
      DASHBOARD_GRID_COLS
    )

    expect(pickCoreLayout(toRglLayout(resolved))).toEqual(pickCoreLayout(rgl))
  })
})
