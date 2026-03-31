import Link from 'next/link'

import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/app/EmptyState'
import { KpiCard } from '@/components/app/KpiCard'
import { PageHeader } from '@/components/app/PageHeader'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

type MetricsRow = {
  date: string
  total_tenants: number
  total_parcele: number
  total_recoltari: number
  total_vanzari: number
  total_kg_cal1: number
  total_kg_cal2: number
  total_revenue_lei: number
}

type AnalyticsEvent = {
  user_id: string | null
  tenant_id: string | null
  module: string | null
  event_name: string | null
  status: string | null
  created_at: string
  metadata: Record<string, unknown> | null
  page_url: string | null
}

type TenantRow = {
  id: string
  nume_ferma: string | null
  created_at: string | null
  is_demo: boolean | null
}

type AiRange = '7d' | '30d'

export interface AnalyticsDashboardFilters {
  aiRange: AiRange
  aiFlow: string | null
  aiDecisionMode: string | null
}

type AiEvent = {
  createdAt: string
  flowSelected: string
  decisionMode: string
  continuationUsed: boolean
  saveHintEmitted: boolean
  openFormEmitted: boolean
  clarificationKind: string
  flowFinalState: string
  missingRequiredOpenFieldsCount: number
  missingSaveHintFieldsCount: number
  fieldsPresent: string[]
  fieldsMissing: string[]
  llmUsed: boolean
}

type DistributionEntry = {
  key: string
  label: string
  count: number
  share: number
}

type AiFrictionRow = {
  flow: string
  label: string
  total: number
  clarifications: number
  clarificationRate: number
  avgMissingRequired: number
}

type AiSaveHintRow = {
  flow: string
  label: string
  total: number
  saveHints: number
  saveHintRate: number
  avgMissingSaveHint: number
}

type AiLlmRow = {
  flow: string
  label: string
  total: number
  llmCount: number
  llmRate: number
}

type AiHealthStatus = 'good' | 'warning' | 'risk'

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ro-RO').format(value)
}

function formatLei(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function ratio(part: number, total: number): number {
  if (total <= 0) return 0
  return part / total
}

function formatDecimal(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

function sevenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString()
}

function thirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString()
}

function todayStart(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const MODULE_ROUTE_ALIASES: Record<string, string> = {
  'activitati-agricole': 'activitati',
  'vanzari-butasi': 'vanzari',
}

function routeToModuleName(path: string | null): string | null {
  if (!path) return null
  const segment = path.split('/').filter(Boolean)[0]
  if (!segment) return null
  return MODULE_ROUTE_ALIASES[segment] ?? segment
}

const AI_FLOW_ORDER = ['activitate', 'recoltare', 'cheltuiala', 'investitie', 'comanda', 'client', 'none']

const AI_FLOW_LABELS: Record<string, string> = {
  activitate: 'Activitate',
  recoltare: 'Recoltare',
  cheltuiala: 'Cheltuială',
  investitie: 'Investiție',
  comanda: 'Comandă',
  client: 'Client',
  none: 'Neclasificat',
}

const AI_DECISION_MODE_ORDER = ['deterministic', 'ambiguous_clarification', 'continuation', 'llm_fallback']

const AI_DECISION_MODE_LABELS: Record<string, string> = {
  deterministic: 'Deterministic',
  ambiguous_clarification: 'Clarificare ambiguitate',
  continuation: 'Continuare',
  llm_fallback: 'Fallback LLM',
}

const AI_CLARIFICATION_KIND_LABELS: Record<string, string> = {
  missing_required: 'Câmpuri lipsă',
  ambiguity: 'Ambiguitate',
  generic_fallback: 'Fallback generic',
  none: 'Fără clarificare',
}

const AI_FLOW_FINAL_STATE_LABELS: Record<string, string> = {
  clarify: 'Clarificare',
  open_form: 'Open form',
  report: 'Raport',
  fallback: 'Fallback',
  limit: 'Limită',
  error: 'Eroare',
}

const AI_BETA_RATE_THRESHOLDS = {
  llmFallbackRate: { goodMax: 0.15, warningMax: 0.3 },
  clarificationRate: { goodMax: 0.35, warningMax: 0.5 },
  openFormRate: { goodMin: 0.55, warningMin: 0.4 },
  saveHintRate: { goodMax: 0.25, warningMax: 0.4 },
  continuationRate: { goodMin: 0.1, goodMax: 0.45, warningMin: 0.06, warningMax: 0.6 },
  avgMissingRequiredOpen: { goodMax: 1.2, warningMax: 1.8 },
} as const

const AI_STATUS_META: Record<
  AiHealthStatus,
  { label: 'Bun' | 'Atenție' | 'Risc'; className: string; trend: 'up' | 'neutral' | 'down' }
> = {
  good: {
    label: 'Bun',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    trend: 'up',
  },
  warning: {
    label: 'Atenție',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    trend: 'neutral',
  },
  risk: {
    label: 'Risc',
    className: 'border-red-200 bg-red-50 text-red-800',
    trend: 'down',
  },
}

function classifyLowerBetter(
  value: number,
  threshold: { goodMax: number; warningMax: number }
): AiHealthStatus {
  if (value <= threshold.goodMax) return 'good'
  if (value <= threshold.warningMax) return 'warning'
  return 'risk'
}

function classifyHigherBetter(
  value: number,
  threshold: { goodMin: number; warningMin: number }
): AiHealthStatus {
  if (value >= threshold.goodMin) return 'good'
  if (value >= threshold.warningMin) return 'warning'
  return 'risk'
}

function classifyRange(
  value: number,
  threshold: { goodMin: number; goodMax: number; warningMin: number; warningMax: number }
): AiHealthStatus {
  if (value >= threshold.goodMin && value <= threshold.goodMax) return 'good'
  if (value >= threshold.warningMin && value <= threshold.warningMax) return 'warning'
  return 'risk'
}

function statusWeight(status: AiHealthStatus): number {
  if (status === 'risk') return 2
  if (status === 'warning') return 1
  return 0
}

function readAnalyticsObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function readBoolean(value: unknown): boolean {
  return value === true || value === 'true'
}

function readNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function readString(value: unknown, fallback = 'none'): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getAiFlowLabel(flow: string): string {
  return AI_FLOW_LABELS[flow] ?? flow
}

function getAiDecisionModeLabel(mode: string): string {
  return AI_DECISION_MODE_LABELS[mode] ?? mode
}

function getAiClarificationKindLabel(kind: string): string {
  return AI_CLARIFICATION_KIND_LABELS[kind] ?? kind
}

function getAiFlowFinalStateLabel(state: string): string {
  return AI_FLOW_FINAL_STATE_LABELS[state] ?? state
}

function compareAiFlows(a: string, b: string): number {
  const orderA = AI_FLOW_ORDER.indexOf(a)
  const orderB = AI_FLOW_ORDER.indexOf(b)
  if (orderA !== -1 || orderB !== -1) {
    if (orderA === -1) return 1
    if (orderB === -1) return -1
    return orderA - orderB
  }
  return a.localeCompare(b, 'ro')
}

function compareAiDecisionModes(a: string, b: string): number {
  const orderA = AI_DECISION_MODE_ORDER.indexOf(a)
  const orderB = AI_DECISION_MODE_ORDER.indexOf(b)
  if (orderA !== -1 || orderB !== -1) {
    if (orderA === -1) return 1
    if (orderB === -1) return -1
    return orderA - orderB
  }
  return a.localeCompare(b, 'ro')
}

function parseAiEvent(event: AnalyticsEvent): AiEvent | null {
  const metadata = readAnalyticsObject(event.metadata)
  if (!metadata) return null

  return {
    createdAt: event.created_at,
    flowSelected: readString(metadata.flow_selected),
    decisionMode: readString(metadata.decision_mode),
    continuationUsed: readBoolean(metadata.continuation_used),
    saveHintEmitted: readBoolean(metadata.save_hint_emitted),
    openFormEmitted: readBoolean(metadata.open_form_emitted),
    clarificationKind: readString(metadata.clarification_kind),
    flowFinalState: readString(metadata.flow_final_state, 'fallback'),
    missingRequiredOpenFieldsCount: readNumber(metadata.missing_required_open_fields_count),
    missingSaveHintFieldsCount: readNumber(metadata.missing_save_hint_fields_count),
    fieldsPresent: readStringArray(metadata.fields_present),
    fieldsMissing: readStringArray(metadata.fields_missing),
    llmUsed: readBoolean(metadata.llm_used),
  }
}

function buildDistributionEntries(
  counts: Map<string, number>,
  total: number,
  formatter: (key: string) => string
): DistributionEntry[] {
  return Array.from(counts.entries())
    .map(([key, count]) => ({
      key,
      label: formatter(key),
      count,
      share: ratio(count, total),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ro'))
}

function buildAnalyticsHref(
  filters: AnalyticsDashboardFilters,
  updates: Partial<AnalyticsDashboardFilters>
): string {
  const next: AnalyticsDashboardFilters = {
    aiRange: updates.aiRange ?? filters.aiRange,
    aiFlow: updates.aiFlow === undefined ? filters.aiFlow : updates.aiFlow,
    aiDecisionMode: updates.aiDecisionMode === undefined ? filters.aiDecisionMode : updates.aiDecisionMode,
  }

  const params = new URLSearchParams()
  if (next.aiRange !== '30d') params.set('aiRange', next.aiRange)
  if (next.aiFlow) params.set('aiFlow', next.aiFlow)
  if (next.aiDecisionMode) params.set('aiDecisionMode', next.aiDecisionMode)

  const query = params.toString()
  return query ? `/admin/analytics?${query}` : '/admin/analytics'
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Button asChild size="sm" variant={active ? 'default' : 'outline'} className="rounded-full">
      <Link href={href}>{label}</Link>
    </Button>
  )
}

function DistributionList({
  rows,
  emptyMessage,
}: {
  rows: DistributionEntry[]
  emptyMessage: string
}) {
  const maxCount = rows[0]?.count ?? 1

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center justify-between sm:contents">
            <span className="text-sm font-medium text-[var(--agri-text)] sm:w-36 sm:shrink-0">
              {row.label}
            </span>
            <span className="text-xs text-muted-foreground sm:hidden">
              {formatPercent(row.share)}
            </span>
          </div>
          <div className="flex flex-1 items-center gap-2">
            <div className="flex-1 overflow-hidden rounded-full bg-[var(--agri-surface-muted)]">
              <div
                className="h-4 rounded-full bg-emerald-500"
                style={{
                  width: `${Math.max(4, Math.round((row.count / maxCount) * 100))}%`,
                }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-sm font-semibold">{row.count}</span>
          </div>
          <span className="hidden sm:block sm:w-20 sm:shrink-0 sm:text-right sm:text-xs sm:text-muted-foreground">
            {formatPercent(row.share)}
          </span>
        </div>
      ))}
    </div>
  )
}

export async function AnalyticsDashboard({
  filters = {
    aiRange: '30d',
    aiFlow: null,
    aiDecisionMode: null,
  },
}: {
  filters?: AnalyticsDashboardFilters
}) {
  const supabase = await createClient()
  const admin = getSupabaseAdmin()

  const today = new Date().toISOString().slice(0, 10)
  const { error: refreshError } = await supabase.rpc('refresh_tenant_metrics_daily', { p_date: today })

  const { data: metricsData, error: metricsError } = await supabase
    .from('tenant_metrics_daily')
    .select('date,total_tenants,total_parcele,total_recoltari,total_vanzari,total_kg_cal1,total_kg_cal2,total_revenue_lei')
    .order('date', { ascending: false })
    .limit(30)

  // — KPI counts —
  const [
    { count: totalUsers },
    { count: totalTenants },
    { count: demoTenants },
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('tenants').select('id', { count: 'exact', head: true }),
    admin.from('tenants').select('id', { count: 'exact', head: true }).eq('is_demo', true),
  ])

  // — 7-day events for KPI cards (DAU / WAU / active tenants) —
  const { data: raw7d } = await admin
    .from('analytics_events')
    .select('user_id, tenant_id, module, event_name, status, created_at, metadata, page_url')
    .gte('created_at', sevenDaysAgo())

  const events7d: AnalyticsEvent[] = (raw7d ?? []) as unknown as AnalyticsEvent[]

  const activeTenantIds7d = new Set(events7d.map((e) => e.tenant_id).filter(Boolean))
  const activeTenants7d = activeTenantIds7d.size

  const todayStr = todayStart()
  const dau = new Set(
    events7d.filter((e) => e.created_at >= todayStr && e.user_id).map((e) => e.user_id)
  ).size
  const wau = new Set(events7d.filter((e) => e.user_id).map((e) => e.user_id)).size

  // — 30-day events for the analytics sections below —
  const { data: raw30d } = await admin
    .from('analytics_events')
    .select('user_id, tenant_id, module, event_name, status, created_at, metadata, page_url')
    .gte('created_at', thirtyDaysAgo())
    .order('created_at', { ascending: false })

  const events30d: AnalyticsEvent[] = (raw30d ?? []) as unknown as AnalyticsEvent[]

  // — 1. Module usage — view_module (trackEvent, uses module col) OR page_view (track, uses page_url) —
  const moduleViewMap: Record<string, { count: number; users: Set<string> }> = {}
  for (const e of events30d) {
    let mod: string | null = null
    if (e.event_name === 'view_module' && e.module) {
      mod = e.module
    } else if (e.event_name === 'page_view') {
      mod = routeToModuleName(e.page_url)
    }
    if (!mod) continue
    if (!moduleViewMap[mod]) moduleViewMap[mod] = { count: 0, users: new Set() }
    moduleViewMap[mod].count++
    if (e.user_id) moduleViewMap[mod].users.add(e.user_id)
  }
  const moduleViewEntries = Object.entries(moduleViewMap)
    .map(([mod, d]) => ({ mod, count: d.count, uniqueUsers: d.users.size }))
    .sort((a, b) => b.count - a.count)
  const maxModuleViews = moduleViewEntries[0]?.count ?? 1

  // — 2. Operations funnel — open_create_form / create_success / form_abandoned —
  const funnelModuleSet = new Set(
    events30d
      .filter((e) => ['open_create_form', 'create_success', 'form_abandoned'].includes(e.event_name ?? ''))
      .map((e) => e.module)
      .filter((m): m is string => Boolean(m))
  )
  const funnelData = Array.from(funnelModuleSet).map((mod) => {
    const modEvents = events30d.filter((e) => e.module === mod)
    const opened = modEvents.filter((e) => e.event_name === 'open_create_form').length
    const succeeded = modEvents.filter((e) => e.event_name === 'create_success').length
    const abandoned = modEvents.filter((e) => e.event_name === 'form_abandoned').length
    return { module: mod, opened, succeeded, abandoned }
  }).sort((a, b) => b.opened - a.opened)

  // — 3. Inactive tenants — no events in last 7 days —
  const { data: allTenants } = await admin
    .from('tenants')
    .select('id, nume_ferma, created_at, is_demo')
    .eq('is_demo', false)
    .order('created_at', { ascending: false })

  // Build last-activity map from 30-day events (covers 7–30 day inactive cases)
  const tenantLastActivity: Record<string, string> = {}
  for (const e of events30d) {
    if (!e.tenant_id) continue
    if (!tenantLastActivity[e.tenant_id] || e.created_at > tenantLastActivity[e.tenant_id]) {
      tenantLastActivity[e.tenant_id] = e.created_at
    }
  }

  const now = new Date(todayStr).getTime()
  const inactiveTenants = ((allTenants ?? []) as unknown as TenantRow[])
    .filter((t: TenantRow) => !activeTenantIds7d.has(t.id))
    .map((t: TenantRow) => {
      const lastActivity = tenantLastActivity[t.id] ?? null
      const referenceTs = lastActivity
        ? new Date(lastActivity).getTime()
        : new Date(t.created_at ?? todayStr).getTime()
      const daysInactive = Math.floor((now - referenceTs) / 86_400_000)
      return { ...t, lastActivity, daysInactive }
    })
    .sort((a, b) => b.daysInactive - a.daysInactive)

  // — 4. Top failed actions — status = 'failed', group by module + event_name + error —
  type FailedGroup = { count: number; module: string; eventName: string; errorMessage: string }
  const failedGroupMap: Record<string, FailedGroup> = {}
  for (const e of events30d) {
    if (e.status !== 'failed') continue
    const errorMsg =
      (e.metadata as Record<string, unknown> | null)?.error_message as string | undefined ?? '—'
    const key = `${e.module ?? 'general'}::${e.event_name ?? 'unknown'}::${errorMsg}`
    if (!failedGroupMap[key]) {
      failedGroupMap[key] = {
        count: 0,
        module: e.module ?? 'general',
        eventName: e.event_name ?? 'unknown',
        errorMessage: errorMsg,
      }
    }
    failedGroupMap[key].count++
  }
  const topFailed = Object.values(failedGroupMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const aiRangeStart = filters.aiRange === '7d' ? sevenDaysAgo() : thirtyDaysAgo()
  const aiEventsInRange = events30d
    .filter((event) => event.event_name === 'ai_chat_decision' && event.created_at >= aiRangeStart)
    .map(parseAiEvent)
    .filter((event): event is AiEvent => Boolean(event))

  const aiFlowOptions = Array.from(new Set(aiEventsInRange.map((event) => event.flowSelected))).sort(compareAiFlows)
  const aiDecisionModeOptions = Array.from(new Set(aiEventsInRange.map((event) => event.decisionMode))).sort(compareAiDecisionModes)
  const aiEvents = aiEventsInRange.filter((event) => {
    if (filters.aiFlow && event.flowSelected !== filters.aiFlow) return false
    if (filters.aiDecisionMode && event.decisionMode !== filters.aiDecisionMode) return false
    return true
  })

  const totalAiInteractions = aiEvents.length
  const aiOpenFormCount = aiEvents.filter((event) => event.openFormEmitted).length
  const aiClarificationCount = aiEvents.filter((event) => event.flowFinalState === 'clarify').length
  const aiLlmFallbackCount = aiEvents.filter((event) => event.decisionMode === 'llm_fallback').length
  const aiSaveHintCount = aiEvents.filter((event) => event.saveHintEmitted).length
  const aiContinuationCount = aiEvents.filter((event) => event.continuationUsed).length

  const aiFlowCounts = new Map<string, number>()
  const aiDecisionModeCounts = new Map<string, number>()
  const aiClarificationKindCounts = new Map<string, number>()
  const aiFrictionMap = new Map<string, AiFrictionRow>()
  const aiSaveHintMap = new Map<string, AiSaveHintRow>()
  const aiLlmMap = new Map<string, AiLlmRow>()
  const aiLlmStateCounts = new Map<string, number>()

  for (const event of aiEvents) {
    aiFlowCounts.set(event.flowSelected, (aiFlowCounts.get(event.flowSelected) ?? 0) + 1)
    aiDecisionModeCounts.set(event.decisionMode, (aiDecisionModeCounts.get(event.decisionMode) ?? 0) + 1)

    if (event.clarificationKind !== 'none') {
      aiClarificationKindCounts.set(
        event.clarificationKind,
        (aiClarificationKindCounts.get(event.clarificationKind) ?? 0) + 1
      )
    }

    const flowLabel = getAiFlowLabel(event.flowSelected)

    const frictionRow = aiFrictionMap.get(event.flowSelected) ?? {
      flow: event.flowSelected,
      label: flowLabel,
      total: 0,
      clarifications: 0,
      clarificationRate: 0,
      avgMissingRequired: 0,
    }
    frictionRow.total += 1
    if (event.flowFinalState === 'clarify') {
      frictionRow.clarifications += 1
      frictionRow.avgMissingRequired += event.missingRequiredOpenFieldsCount
    }
    aiFrictionMap.set(event.flowSelected, frictionRow)

    const saveHintRow = aiSaveHintMap.get(event.flowSelected) ?? {
      flow: event.flowSelected,
      label: flowLabel,
      total: 0,
      saveHints: 0,
      saveHintRate: 0,
      avgMissingSaveHint: 0,
    }
    saveHintRow.total += 1
    if (event.saveHintEmitted) {
      saveHintRow.saveHints += 1
      saveHintRow.avgMissingSaveHint += event.missingSaveHintFieldsCount
    }
    aiSaveHintMap.set(event.flowSelected, saveHintRow)

    const llmRow = aiLlmMap.get(event.flowSelected) ?? {
      flow: event.flowSelected,
      label: flowLabel,
      total: 0,
      llmCount: 0,
      llmRate: 0,
    }
    llmRow.total += 1
    if (event.llmUsed) {
      llmRow.llmCount += 1
      aiLlmStateCounts.set(event.flowFinalState, (aiLlmStateCounts.get(event.flowFinalState) ?? 0) + 1)
    }
    aiLlmMap.set(event.flowSelected, llmRow)
  }

  const aiFlowDistribution = buildDistributionEntries(aiFlowCounts, totalAiInteractions, getAiFlowLabel)
    .sort((a, b) => b.count - a.count || compareAiFlows(a.key, b.key))
  const aiDecisionModeDistribution = buildDistributionEntries(
    aiDecisionModeCounts,
    totalAiInteractions,
    getAiDecisionModeLabel
  ).sort((a, b) => b.count - a.count || compareAiDecisionModes(a.key, b.key))
  const topAiClarificationKinds = Array.from(aiClarificationKindCounts.entries())
    .map(([key, count]) => ({ key, label: getAiClarificationKindLabel(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ro'))
    .slice(0, 4)

  const aiFrictionRows = Array.from(aiFrictionMap.values())
    .map((row) => ({
      ...row,
      clarificationRate: ratio(row.clarifications, row.total),
      avgMissingRequired: row.clarifications > 0 ? row.avgMissingRequired / row.clarifications : 0,
    }))
    .sort((a, b) => b.clarifications - a.clarifications || b.clarificationRate - a.clarificationRate || compareAiFlows(a.flow, b.flow))

  const aiSaveHintRows = Array.from(aiSaveHintMap.values())
    .map((row) => ({
      ...row,
      saveHintRate: ratio(row.saveHints, row.total),
      avgMissingSaveHint: row.saveHints > 0 ? row.avgMissingSaveHint / row.saveHints : 0,
    }))
    .sort((a, b) => b.saveHints - a.saveHints || b.saveHintRate - a.saveHintRate || compareAiFlows(a.flow, b.flow))

  const aiLlmRows = Array.from(aiLlmMap.values())
    .map((row) => ({
      ...row,
      llmRate: ratio(row.llmCount, row.total),
    }))
    .sort((a, b) => b.llmCount - a.llmCount || b.llmRate - a.llmRate || compareAiFlows(a.flow, b.flow))
  const aiLlmStateRows = Array.from(aiLlmStateCounts.entries())
    .map(([key, count]) => ({ key, label: getAiFlowFinalStateLabel(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ro'))

  const aiTrendDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    const iso = date.toISOString().slice(0, 10)
    const dayEvents = aiEvents.filter((event) => event.createdAt.slice(0, 10) === iso)
    return {
      day: iso,
      total: dayEvents.length,
      llmUsed: dayEvents.filter((event) => event.llmUsed).length,
    }
  })

  const aiRecentEvents = aiEvents.slice(0, 20)

  const aiOpenFormRate = ratio(aiOpenFormCount, totalAiInteractions)
  const aiClarificationRate = ratio(aiClarificationCount, totalAiInteractions)
  const aiLlmFallbackRate = ratio(aiLlmFallbackCount, totalAiInteractions)
  const aiSaveHintRate = ratio(aiSaveHintCount, totalAiInteractions)
  const aiContinuationRate = ratio(aiContinuationCount, totalAiInteractions)
  const avgMissingRequiredOpenForClarify = aiClarificationCount > 0
    ? aiEvents
      .filter((event) => event.flowFinalState === 'clarify')
      .reduce((sum, event) => sum + event.missingRequiredOpenFieldsCount, 0) / aiClarificationCount
    : 0

  const aiKpiHealth = {
    openFormRate: classifyHigherBetter(aiOpenFormRate, AI_BETA_RATE_THRESHOLDS.openFormRate),
    clarificationRate: classifyLowerBetter(aiClarificationRate, AI_BETA_RATE_THRESHOLDS.clarificationRate),
    llmFallbackRate: classifyLowerBetter(aiLlmFallbackRate, AI_BETA_RATE_THRESHOLDS.llmFallbackRate),
    saveHintRate: classifyLowerBetter(aiSaveHintRate, AI_BETA_RATE_THRESHOLDS.saveHintRate),
    continuationRate: classifyRange(aiContinuationRate, AI_BETA_RATE_THRESHOLDS.continuationRate),
    avgMissingRequiredOpen: classifyLowerBetter(
      avgMissingRequiredOpenForClarify,
      AI_BETA_RATE_THRESHOLDS.avgMissingRequiredOpen
    ),
  }

  const aiNeedsAttentionNow: Array<{ severity: AiHealthStatus; text: string }> = []
  if (aiKpiHealth.llmFallbackRate !== 'good') {
    aiNeedsAttentionNow.push({
      severity: aiKpiHealth.llmFallbackRate,
      text: 'Fallback AI este peste pragul beta.',
    })
  }
  if (aiKpiHealth.clarificationRate !== 'good') {
    aiNeedsAttentionNow.push({
      severity: aiKpiHealth.clarificationRate,
      text: 'Clarificările sunt peste pragul beta.',
    })
  }
  if (aiKpiHealth.openFormRate !== 'good') {
    aiNeedsAttentionNow.push({
      severity: aiKpiHealth.openFormRate,
      text: 'Rata open_form este sub pragul țintă.',
    })
  }
  if (aiKpiHealth.saveHintRate !== 'good') {
    aiNeedsAttentionNow.push({
      severity: aiKpiHealth.saveHintRate,
      text: 'Save hints apar des; verifică flow-urile cu fricțiune.',
    })
  }
  if (aiKpiHealth.avgMissingRequiredOpen !== 'good') {
    aiNeedsAttentionNow.push({
      severity: aiKpiHealth.avgMissingRequiredOpen,
      text: 'Lipsurile medii înainte de open_form sunt ridicate.',
    })
  }
  const topSaveHintFlow = aiSaveHintRows[0]
  if (topSaveHintFlow && topSaveHintFlow.saveHintRate >= AI_BETA_RATE_THRESHOLDS.saveHintRate.warningMax) {
    aiNeedsAttentionNow.push({
      severity: 'risk',
      text: `Save hints ridicat pe flow-ul ${topSaveHintFlow.label}.`,
    })
  } else if (topSaveHintFlow && topSaveHintFlow.saveHintRate >= AI_BETA_RATE_THRESHOLDS.saveHintRate.goodMax) {
    aiNeedsAttentionNow.push({
      severity: 'warning',
      text: `Save hints peste țintă pe flow-ul ${topSaveHintFlow.label}.`,
    })
  }
  aiNeedsAttentionNow.sort((a, b) => statusWeight(b.severity) - statusWeight(a.severity))

  const aiFrictionStatusByFlow = new Map<string, AiHealthStatus>(
    aiFrictionRows.map((row) => [
      row.flow,
      classifyLowerBetter(row.clarificationRate, AI_BETA_RATE_THRESHOLDS.clarificationRate),
    ])
  )
  const aiSaveHintStatusByFlow = new Map<string, AiHealthStatus>(
    aiSaveHintRows.map((row) => [
      row.flow,
      classifyLowerBetter(row.saveHintRate, AI_BETA_RATE_THRESHOLDS.saveHintRate),
    ])
  )
  const aiLlmStatusByFlow = new Map<string, AiHealthStatus>(
    aiLlmRows.map((row) => [
      row.flow,
      classifyLowerBetter(row.llmRate, AI_BETA_RATE_THRESHOLDS.llmFallbackRate),
    ])
  )

  const rows = (metricsData ?? []) as MetricsRow[]
  const latest = rows[0]
  const hasMetricsError = refreshError || metricsError

  return (
    <AppShell
      header={
        <PageHeader
          title="📊 Beta Analytics"
          subtitle="Statistici utilizatori și comportament în aplicație"
        />
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 py-4">

        {/* — KPI Cards — */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard title="Utilizatori totali" value={formatNumber(totalUsers ?? 0)} />
          <KpiCard title="Tenanți totali" value={formatNumber(totalTenants ?? 0)} />
          <KpiCard title="Tenanți demo" value={formatNumber(demoTenants ?? 0)} />
          <KpiCard title="Tenanți activi 7z" value={formatNumber(activeTenants7d)} />
          <KpiCard title="DAU (azi)" value={formatNumber(dau)} />
          <KpiCard title="WAU (7 zile)" value={formatNumber(wau)} />
        </section>

        {/* — Tenant Metrics — */}
        {hasMetricsError ? (
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-800">
              Eroare la încărcare metrici agregate:{' '}
              {refreshError?.message ?? metricsError?.message}
            </CardContent>
          </Card>
        ) : latest ? (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <KpiCard
                title="Tenanți activi (zi curentă)"
                value={formatNumber(latest.total_tenants)}
              />
              <KpiCard title="Total terenuri" value={formatNumber(latest.total_parcele)} />
              <KpiCard
                title="Înregistrări recoltări"
                value={formatNumber(latest.total_recoltari)}
              />
              <KpiCard
                title="Kg recoltate"
                value={formatNumber(
                  Number(latest.total_kg_cal1 || 0) + Number(latest.total_kg_cal2 || 0)
                )}
              />
              <KpiCard
                title="Venit agregat"
                value={formatLei(Number(latest.total_revenue_lei || 0))}
              />
            </section>

            <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
              <CardHeader>
                <CardTitle>Evoluție 30 zile</CardTitle>
                <CardDescription>
                  Date agregate anonimizate. Nu sunt expuse date identificabile pe tenant.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right tabular-nums">Tenanți activi</TableHead>
                      <TableHead className="text-right tabular-nums">Recoltări</TableHead>
                      <TableHead className="text-right tabular-nums">Vânzări</TableHead>
                      <TableHead className="text-right tabular-nums">Kg Cal1</TableHead>
                      <TableHead className="text-right tabular-nums">Kg Cal2</TableHead>
                      <TableHead className="text-right tabular-nums">Venit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(row.total_tenants)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(row.total_recoltari)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(row.total_vanzari)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(Number(row.total_kg_cal1 || 0))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(Number(row.total_kg_cal2 || 0))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatLei(Number(row.total_revenue_lei || 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <EmptyState
            title="Nu există date agregate"
            description="Rulează jobul refresh_tenant_metrics_daily pentru a genera primul snapshot zilnic."
          />
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* Sections below use 30-day analytics_events data            */}
        {/* ─────────────────────────────────────────────────────────── */}

        <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
          <CardHeader>
            <CardTitle>AI chat</CardTitle>
            <CardDescription>
              Observabilitate pragmatică pentru beta și hardening, bazată pe `ai_chat_decision`, fără text brut de utilizator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interval</p>
                <div className="flex flex-wrap gap-2">
                  <FilterLink href={buildAnalyticsHref(filters, { aiRange: '7d' })} label="7 zile" active={filters.aiRange === '7d'} />
                  <FilterLink href={buildAnalyticsHref(filters, { aiRange: '30d' })} label="30 zile" active={filters.aiRange === '30d'} />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flow</p>
                <div className="flex flex-wrap gap-2">
                  <FilterLink href={buildAnalyticsHref(filters, { aiFlow: null })} label="Toate" active={!filters.aiFlow} />
                  {aiFlowOptions.map((flow) => (
                    <FilterLink
                      key={flow}
                      href={buildAnalyticsHref(filters, { aiFlow: flow })}
                      label={getAiFlowLabel(flow)}
                      active={filters.aiFlow === flow}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision mode</p>
                <div className="flex flex-wrap gap-2">
                  <FilterLink
                    href={buildAnalyticsHref(filters, { aiDecisionMode: null })}
                    label="Toate"
                    active={!filters.aiDecisionMode}
                  />
                  {aiDecisionModeOptions.map((mode) => (
                    <FilterLink
                      key={mode}
                      href={buildAnalyticsHref(filters, { aiDecisionMode: mode })}
                      label={getAiDecisionModeLabel(mode)}
                      active={filters.aiDecisionMode === mode}
                    />
                  ))}
                </div>
              </div>
            </div>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <KpiCard
                title="Interacțiuni AI"
                value={formatNumber(totalAiInteractions)}
                subtitle="după filtrele active"
              />
              <KpiCard
                title="Rată open_form"
                value={formatPercent(aiOpenFormRate)}
                subtitle={`${AI_STATUS_META[aiKpiHealth.openFormRate].label} · ${formatNumber(aiOpenFormCount)} răspunsuri`}
                trend={AI_STATUS_META[aiKpiHealth.openFormRate].trend}
                icon={<span className="text-[10px] font-semibold">{AI_STATUS_META[aiKpiHealth.openFormRate].label}</span>}
              />
              <KpiCard
                title="Rată clarificări"
                value={formatPercent(aiClarificationRate)}
                subtitle={`${AI_STATUS_META[aiKpiHealth.clarificationRate].label} · ${formatNumber(aiClarificationCount)} clarificări`}
                trend={AI_STATUS_META[aiKpiHealth.clarificationRate].trend}
                icon={<span className="text-[10px] font-semibold">{AI_STATUS_META[aiKpiHealth.clarificationRate].label}</span>}
              />
              <KpiCard
                title="Rată llm_fallback"
                value={formatPercent(aiLlmFallbackRate)}
                subtitle={`${AI_STATUS_META[aiKpiHealth.llmFallbackRate].label} · ${formatNumber(aiLlmFallbackCount)} decizii`}
                trend={AI_STATUS_META[aiKpiHealth.llmFallbackRate].trend}
                icon={<span className="text-[10px] font-semibold">{AI_STATUS_META[aiKpiHealth.llmFallbackRate].label}</span>}
              />
              <KpiCard
                title="Rată save_hint"
                value={formatPercent(aiSaveHintRate)}
                subtitle={`${AI_STATUS_META[aiKpiHealth.saveHintRate].label} · ${formatNumber(aiSaveHintCount)} hints`}
                trend={AI_STATUS_META[aiKpiHealth.saveHintRate].trend}
                icon={<span className="text-[10px] font-semibold">{AI_STATUS_META[aiKpiHealth.saveHintRate].label}</span>}
              />
              <KpiCard
                title="Rată continuation"
                value={formatPercent(aiContinuationRate)}
                subtitle={`${AI_STATUS_META[aiKpiHealth.continuationRate].label} · ${formatNumber(aiContinuationCount)} continuări`}
                trend={AI_STATUS_META[aiKpiHealth.continuationRate].trend}
                icon={<span className="text-[10px] font-semibold">{AI_STATUS_META[aiKpiHealth.continuationRate].label}</span>}
              />
            </section>

            <div className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] p-3">
              <p className="text-xs text-muted-foreground">
                Cum citesc semnalele: <span className="font-medium text-emerald-700">Bun</span> = în ținta beta, <span className="font-medium text-amber-700">Atenție</span> = urmărește trendul, <span className="font-medium text-red-700">Risc</span> = prioritizează hardening.
              </p>
            </div>

            {totalAiInteractions === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nu există evenimente `ai_chat_decision` în intervalul și filtrele selectate.
              </p>
            ) : (
              <>
                {aiNeedsAttentionNow.length > 0 && (
                  <Card className="rounded-2xl border-amber-200 bg-amber-50 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-amber-900">Necesită atenție acum</CardTitle>
                      <CardDescription className="text-amber-700">
                        Semnale pragmatice de beta, orientative pentru hardening (nu SLA final).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {aiNeedsAttentionNow.slice(0, 5).map((item, index) => (
                        <div key={`${item.text}-${index}`} className="flex items-center gap-2 text-sm text-amber-900">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${AI_STATUS_META[item.severity].className}`}>
                            {AI_STATUS_META[item.severity].label}
                          </span>
                          <span>{item.text}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <section className="grid gap-4 xl:grid-cols-2">
                  <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
                    <CardHeader>
                      <CardTitle>Distribuție pe flow-uri</CardTitle>
                      <CardDescription>Ce flow-uri AI sunt folosite cel mai des în usage real.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DistributionList
                        rows={aiFlowDistribution}
                        emptyMessage="Nu există flow-uri în filtrul curent."
                      />
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
                    <CardHeader>
                      <CardTitle>Distribuție pe decision mode</CardTitle>
                      <CardDescription>Semnal rapid pentru cât de mult merge AI-ul deterministic vs fallback.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DistributionList
                        rows={aiDecisionModeDistribution}
                        emptyMessage="Nu există decizii în filtrul curent."
                      />
                    </CardContent>
                  </Card>
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
                    <CardHeader>
                      <CardTitle>Fricțiune și clarificări</CardTitle>
                      <CardDescription>Flow-urile care cer cel mai des clarificări și câmpuri obligatorii lipsă.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-0">
                      <div className="overflow-x-auto px-4 pt-1 sm:px-6">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Flow</TableHead>
                              <TableHead className="text-right tabular-nums">Clarificări</TableHead>
                              <TableHead className="text-right tabular-nums">% clarify</TableHead>
                              <TableHead className="text-right tabular-nums">Medie lipsuri open</TableHead>
                              <TableHead className="text-right tabular-nums">Semnal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {aiFrictionRows.map((row) => (
                              <TableRow key={row.flow}>
                                <TableCell className="font-medium">{row.label}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.clarifications}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatPercent(row.clarificationRate)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {row.clarifications > 0 ? formatDecimal(row.avgMissingRequired) : '—'}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${AI_STATUS_META[aiFrictionStatusByFlow.get(row.flow) ?? 'good'].className}`}>
                                    {AI_STATUS_META[aiFrictionStatusByFlow.get(row.flow) ?? 'good'].label}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="space-y-2 px-4 pb-4 sm:px-6">
                        <p className="text-sm font-medium text-[var(--agri-text)]">Top clarification_kind</p>
                        {topAiClarificationKinds.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nu există clarificări în filtrul curent.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {topAiClarificationKinds.map((item) => (
                              <span
                                key={item.key}
                                className="inline-flex items-center rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--agri-text)]"
                              >
                                {item.label}: {item.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
                    <CardHeader>
                      <CardTitle>Save hints</CardTitle>
                      <CardDescription>Unde se deschide formularul, dar mai rămân detalii importante de completat.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Flow</TableHead>
                              <TableHead className="text-right tabular-nums">Save hints</TableHead>
                              <TableHead className="text-right tabular-nums">Rată</TableHead>
                              <TableHead className="text-right tabular-nums">Medie lipsuri save</TableHead>
                              <TableHead className="text-right tabular-nums">Semnal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {aiSaveHintRows.map((row) => (
                              <TableRow key={row.flow}>
                                <TableCell className="font-medium">{row.label}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.saveHints}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatPercent(row.saveHintRate)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {row.saveHints > 0 ? formatDecimal(row.avgMissingSaveHint) : '—'}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${AI_STATUS_META[aiSaveHintStatusByFlow.get(row.flow) ?? 'good'].className}`}>
                                    {AI_STATUS_META[aiSaveHintStatusByFlow.get(row.flow) ?? 'good'].label}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                  <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
                    <CardHeader>
                      <CardTitle>Fallback și usage LLM</CardTitle>
                      <CardDescription>Rată `llm_used` pe flow, utilă pentru hardening și reducerea costului.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 p-0">
                      <div className="overflow-x-auto px-4 pt-1 sm:px-6">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Flow</TableHead>
                              <TableHead className="text-right tabular-nums">LLM</TableHead>
                              <TableHead className="text-right tabular-nums">Rată</TableHead>
                              <TableHead className="text-right tabular-nums">Semnal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {aiLlmRows.map((row) => (
                              <TableRow key={row.flow}>
                                <TableCell className="font-medium">{row.label}</TableCell>
                                <TableCell className="text-right tabular-nums">{row.llmCount}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatPercent(row.llmRate)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${AI_STATUS_META[aiLlmStatusByFlow.get(row.flow) ?? 'good'].className}`}>
                                    {AI_STATUS_META[aiLlmStatusByFlow.get(row.flow) ?? 'good'].label}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="space-y-2 px-4 pb-4 sm:px-6">
                        <p className="text-sm font-medium text-[var(--agri-text)]">Flow final state pentru răspunsurile cu LLM</p>
                        {aiLlmStateRows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nu există usage LLM în filtrul curent.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {aiLlmStateRows.map((row) => (
                              <span
                                key={row.key}
                                className="inline-flex items-center rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--agri-text)]"
                              >
                                {row.label}: {row.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
                    <CardHeader>
                      <CardTitle>Trend LLM 7 zile</CardTitle>
                      <CardDescription>Volum zilnic de răspunsuri care au folosit LLM în ultimele 7 zile.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DistributionList
                        rows={aiTrendDays
                          .filter((row) => row.total > 0 || row.llmUsed > 0)
                          .map((row) => ({
                            key: row.day,
                            label: formatDate(row.day),
                            count: row.llmUsed,
                            share: ratio(row.llmUsed, row.total || 1),
                          }))}
                        emptyMessage="Nu există usage LLM în ultimele 7 zile."
                      />
                    </CardContent>
                  </Card>
                </section>

                <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
                  <CardHeader>
                    <CardTitle>Evenimente AI recente</CardTitle>
                    <CardDescription>
                      Ultimele evenimente structurale `ai_chat_decision`, fără mesaje brute și fără PII inutilă.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Timp</TableHead>
                            <TableHead>Flow</TableHead>
                            <TableHead>Decision mode</TableHead>
                            <TableHead>Final state</TableHead>
                            <TableHead>Clarification</TableHead>
                            <TableHead>Open</TableHead>
                            <TableHead>Save hint</TableHead>
                            <TableHead>LLM</TableHead>
                            <TableHead>Fields present</TableHead>
                            <TableHead>Fields missing</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aiRecentEvents.map((event, index) => (
                            <TableRow key={`${event.createdAt}-${index}`}>
                              <TableCell>{formatDateTime(event.createdAt)}</TableCell>
                              <TableCell className="font-medium">{getAiFlowLabel(event.flowSelected)}</TableCell>
                              <TableCell>{getAiDecisionModeLabel(event.decisionMode)}</TableCell>
                              <TableCell>{getAiFlowFinalStateLabel(event.flowFinalState)}</TableCell>
                              <TableCell>{getAiClarificationKindLabel(event.clarificationKind)}</TableCell>
                              <TableCell>{event.openFormEmitted ? 'Da' : 'Nu'}</TableCell>
                              <TableCell>{event.saveHintEmitted ? 'Da' : 'Nu'}</TableCell>
                              <TableCell>{event.llmUsed ? 'Da' : 'Nu'}</TableCell>
                              <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                                {event.fieldsPresent.length > 0 ? event.fieldsPresent.join(', ') : '—'}
                              </TableCell>
                              <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                                {event.fieldsMissing.length > 0 ? event.fieldsMissing.join(', ') : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </CardContent>
        </Card>

        {/* — 1. Utilizare module — */}
        {moduleViewEntries.length > 0 && (
          <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
            <CardHeader>
              <CardTitle>Utilizare module</CardTitle>
              <CardDescription>
                Vizualizări per modul în ultimele 30 de zile
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {moduleViewEntries.map(({ mod, count, uniqueUsers }) => (
                  <div key={mod} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-center justify-between sm:contents">
                      <span className="text-sm font-medium text-[var(--agri-text)] sm:w-28 sm:shrink-0">
                        {mod}
                      </span>
                      <span className="text-xs text-muted-foreground sm:hidden">
                        {uniqueUsers} util.
                      </span>
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <div className="flex-1 overflow-hidden rounded-full bg-[var(--agri-surface-muted)]">
                        <div
                          className="h-4 rounded-full bg-emerald-500"
                          style={{
                            width: `${Math.round((count / maxModuleViews) * 100)}%`,
                            minWidth: '4px',
                          }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-sm font-semibold">
                        {count}
                      </span>
                    </div>
                    <span className="hidden sm:block sm:w-24 sm:shrink-0 sm:text-right sm:text-xs sm:text-muted-foreground">
                      {uniqueUsers} utilizatori
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* — 2. Flux operațiuni — */}
        <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
          <CardHeader>
            <CardTitle>Flux operațiuni</CardTitle>
            <CardDescription>
              Formulare inițiate vs. finalizate vs. abandonate în ultimele 30 de zile
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {funnelData.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-6">Nu există date.</p>
            ) : (
              <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Modul</TableHead>
                      <TableHead className="text-right tabular-nums">Începute</TableHead>
                      <TableHead className="text-right tabular-nums">Finalizate</TableHead>
                      <TableHead className="text-right tabular-nums">Abandonate</TableHead>
                      <TableHead className="text-right tabular-nums">Rată %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnelData.map((row) => (
                      <TableRow key={row.module}>
                        <TableCell className="font-medium">{row.module}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.opened}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">
                          {row.succeeded}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-amber-600">
                          {row.abandoned}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {row.opened > 0
                            ? `${Math.round((row.succeeded / row.opened) * 100)}%`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* — 3. Tenanți inactivi — */}
        {inactiveTenants.length > 0 && (
          <Card className="rounded-2xl border-amber-200 bg-amber-50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-amber-900">
                ⚠️ Tenanți inactivi (7+ zile)
              </CardTitle>
              <CardDescription className="text-amber-700">
                Tenanți fără activitate înregistrată în ultimele 7 zile
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-amber-800">Tenant</TableHead>
                      <TableHead className="text-right text-amber-800 tabular-nums">Ultima activitate</TableHead>
                      <TableHead className="text-right text-amber-800 tabular-nums">Zile inactiv</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inactiveTenants.map((t) => (
                      <TableRow key={t.id} className="border-amber-100">
                        <TableCell className="font-medium text-amber-900">
                          {t.nume_ferma ?? t.id}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-amber-800">
                          {t.lastActivity ? formatDate(t.lastActivity) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-amber-900">
                          {t.daysInactive > 30 ? '30+' : t.daysInactive}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* — 4. Acțiuni eșuate — */}
        <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
          <CardHeader>
            <CardTitle>Acțiuni eșuate</CardTitle>
            <CardDescription>
              Cele mai frecvente erori în ultimele 30 de zile (top 10)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {topFailed.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-6">Nu există acțiuni eșuate.</p>
            ) : (
              <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Modul</TableHead>
                      <TableHead>Eveniment</TableHead>
                      <TableHead>Eroare</TableHead>
                      <TableHead className="text-right tabular-nums">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topFailed.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.module}</TableCell>
                        <TableCell className="text-muted-foreground">{row.eventName}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {row.errorMessage}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-red-600">
                          {row.count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </AppShell>
  )
}
