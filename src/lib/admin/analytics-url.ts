import type { AiRange, AnalyticsDashboardParams, AnalyticsPeriod, DemoSegment } from '@/lib/admin/analytics-dashboard-data'

export function buildAdminAnalyticsHref(
  current: AnalyticsDashboardParams,
  updates: Partial<AnalyticsDashboardParams>
): string {
  const next: AnalyticsDashboardParams = {
    period: updates.period ?? current.period,
    demo: updates.demo ?? current.demo,
    aiRange: updates.aiRange ?? current.aiRange,
    aiFlow: updates.aiFlow === undefined ? current.aiFlow : updates.aiFlow,
    aiDecisionMode: updates.aiDecisionMode === undefined ? current.aiDecisionMode : updates.aiDecisionMode,
  }

  const params = new URLSearchParams()
  if (next.period !== '30d') params.set('period', next.period)
  if (next.demo !== 'all') params.set('demo', next.demo)
  if (next.aiRange !== '30d') params.set('aiRange', next.aiRange)
  if (next.aiFlow) params.set('aiFlow', next.aiFlow)
  if (next.aiDecisionMode) params.set('aiDecisionMode', next.aiDecisionMode)

  const query = params.toString()
  return query ? `/admin/analytics?${query}` : '/admin/analytics'
}

export function parseAnalyticsParams(searchParams: Record<string, string | string[] | undefined>): AnalyticsDashboardParams {
  const pick = (key: string): string | null => {
    const v = searchParams[key]
    if (Array.isArray(v)) return v[0] ?? null
    return v ?? null
  }

  const periodRaw = pick('period')
  const period: AnalyticsPeriod =
    periodRaw === '7d' || periodRaw === '90d' ? periodRaw : '30d'

  const demoRaw = pick('demo')
  const demo: DemoSegment =
    demoRaw === 'exclude_demo' || demoRaw === 'demo_only' ? demoRaw : 'all'

  const aiRangeRaw = pick('aiRange')
  const aiRange: AiRange = aiRangeRaw === '7d' ? '7d' : '30d'

  const aiFlow = pick('aiFlow')?.trim() || null
  const aiDecisionMode = pick('aiDecisionMode')?.trim() || null

  return { period, demo, aiRange, aiFlow, aiDecisionMode }
}
