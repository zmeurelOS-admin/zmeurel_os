import type { Json } from '@/types/supabase'

export type DashboardWidgetId =
  | 'kpi-summary'
  | 'comenzi-recente'
  | 'activitati-planificate'
  | 'recoltari-recente'
  | 'stocuri-critice'
  | 'sumar-venituri'

export interface DashboardWidgetLayoutItem {
  id: DashboardWidgetId
  x: number
  y: number
  w: number
  h: number
  active: boolean
  static?: boolean
}

export interface DashboardLayoutConfig {
  version: 1
  widgets: DashboardWidgetLayoutItem[]
}

export interface DashboardGridLayoutItem {
  i: DashboardWidgetId
  x: number
  y: number
  w: number
  h: number
  static?: boolean
  isDraggable?: boolean
  isResizable?: boolean
}

export const DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] = [
  'kpi-summary',
  'comenzi-recente',
  'activitati-planificate',
  'recoltari-recente',
  'stocuri-critice',
  'sumar-venituri',
]

export const DASHBOARD_WIDGET_META: Record<
  DashboardWidgetId,
  { title: string; description: string; removable: boolean }
> = {
  'kpi-summary': {
    title: 'KPI Summary',
    description: 'Indicatorii principali ai fermei pentru ziua și sezonul curent.',
    removable: false,
  },
  'comenzi-recente': {
    title: 'Comenzi Recente',
    description: 'Ultimele comenzi și livrări care necesită atenție.',
    removable: true,
  },
  'activitati-planificate': {
    title: 'Activități Planificate',
    description: 'Lucrările programate pentru azi și zilele următoare.',
    removable: true,
  },
  'recoltari-recente': {
    title: 'Recoltări Recente',
    description: 'Ultimele intrări de producție înregistrate în fermă.',
    removable: true,
  },
  'stocuri-critice': {
    title: 'Stocuri Critice',
    description: 'Produsele care se apropie de pragul minim operațional.',
    removable: true,
  },
  'sumar-venituri': {
    title: 'Sumar Venituri',
    description: 'Evoluția veniturilor recente și comparația cu sezonul anterior.',
    removable: true,
  },
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutConfig = {
  version: 1,
  widgets: [
    { id: 'kpi-summary', x: 0, y: 0, w: 12, h: 4, active: true, static: true },
    { id: 'comenzi-recente', x: 0, y: 4, w: 7, h: 16, active: true },
    { id: 'activitati-planificate', x: 7, y: 4, w: 5, h: 4, active: true },
    { id: 'recoltari-recente', x: 7, y: 8, w: 5, h: 4, active: true },
    { id: 'stocuri-critice', x: 7, y: 12, w: 5, h: 4, active: true },
    { id: 'sumar-venituri', x: 7, y: 16, w: 5, h: 4, active: true },
  ],
}

function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === 'string' && DASHBOARD_WIDGET_ORDER.includes(value as DashboardWidgetId)
}

function coerceNumber(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function normalizeDashboardLayout(input: Json | null | undefined): DashboardLayoutConfig {
  const defaults = new Map(
    DEFAULT_DASHBOARD_LAYOUT.widgets.map((widget) => [
      widget.id,
      { ...widget },
    ])
  )

  const widgetsInput =
    input && typeof input === 'object' && !Array.isArray(input) && Array.isArray(input.widgets)
      ? input.widgets
      : []

  for (const item of widgetsInput) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    if (!isDashboardWidgetId(item.id)) continue

    const fallback = defaults.get(item.id)
    if (!fallback) continue

    defaults.set(item.id, {
      id: item.id,
      x: coerceNumber(item.x, fallback.x),
      y: coerceNumber(item.y, fallback.y),
      w: Math.max(1, coerceNumber(item.w, fallback.w)),
      h: Math.max(3, coerceNumber(item.h, fallback.h)),
      active: item.id === 'kpi-summary' ? true : item.active !== false,
      static: item.id === 'kpi-summary',
    })
  }

  return {
    version: 1,
    widgets: DASHBOARD_WIDGET_ORDER.map((id) => defaults.get(id) ?? DEFAULT_DASHBOARD_LAYOUT.widgets[0]),
  }
}

export function sortDashboardWidgetsForDisplay(widgets: DashboardWidgetLayoutItem[]) {
  return [...widgets].sort((left, right) => {
    if (left.id === 'kpi-summary') return -1
    if (right.id === 'kpi-summary') return 1
    if (left.y !== right.y) return left.y - right.y
    if (left.x !== right.x) return left.x - right.x
    return DASHBOARD_WIDGET_ORDER.indexOf(left.id) - DASHBOARD_WIDGET_ORDER.indexOf(right.id)
  })
}

export function toReactGridLayout(widgets: DashboardWidgetLayoutItem[]): DashboardGridLayoutItem[] {
  return widgets.map((widget) => ({
    i: widget.id,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    static: widget.static,
    isDraggable: widget.static ? false : undefined,
    isResizable: widget.static ? false : undefined,
  }))
}
