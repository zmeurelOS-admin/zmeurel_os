import type { RawAnalyticsEvent } from '@/lib/admin/analytics-dashboard-data'

export type AiEvent = {
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

export const AI_FLOW_ORDER = ['activitate', 'recoltare', 'cheltuiala', 'investitie', 'comanda', 'client', 'none']

export const AI_FLOW_LABELS: Record<string, string> = {
  activitate: 'Activitate',
  recoltare: 'Recoltare',
  cheltuiala: 'Cheltuială',
  investitie: 'Investiție',
  comanda: 'Comandă',
  client: 'Client',
  none: 'Neclasificat',
}

export const AI_DECISION_MODE_ORDER = ['deterministic', 'ambiguous_clarification', 'continuation', 'llm_fallback']

export const AI_DECISION_MODE_LABELS: Record<string, string> = {
  deterministic: 'Deterministic',
  ambiguous_clarification: 'Clarificare ambiguitate',
  continuation: 'Continuare',
  llm_fallback: 'Fallback LLM',
}

export const AI_CLARIFICATION_KIND_LABELS: Record<string, string> = {
  missing_required: 'Câmpuri lipsă',
  ambiguity: 'Ambiguitate',
  generic_fallback: 'Fallback generic',
  none: 'Fără clarificare',
}

export const AI_FLOW_FINAL_STATE_LABELS: Record<string, string> = {
  clarify: 'Clarificare',
  open_form: 'Open form',
  report: 'Raport',
  fallback: 'Fallback',
  limit: 'Limită',
  error: 'Eroare',
}

export type AiHealthStatus = 'good' | 'warning' | 'risk'

export const AI_BETA_RATE_THRESHOLDS = {
  llmFallbackRate: { goodMax: 0.15, warningMax: 0.3 },
  clarificationRate: { goodMax: 0.35, warningMax: 0.5 },
  openFormRate: { goodMin: 0.55, warningMin: 0.4 },
  saveHintRate: { goodMax: 0.25, warningMax: 0.4 },
  continuationRate: { goodMin: 0.1, goodMax: 0.45, warningMin: 0.06, warningMax: 0.6 },
  avgMissingRequiredOpen: { goodMax: 1.2, warningMax: 1.8 },
} as const

export const AI_STATUS_META: Record<
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

/** Prefer `event_data` (schema); fallback `metadata` for legacy rows. */
export function parseAiEvent(event: RawAnalyticsEvent): AiEvent | null {
  const payload =
    readAnalyticsObject(event.event_data) ??
    readAnalyticsObject((event as unknown as { metadata?: unknown }).metadata)
  if (!payload) return null

  return {
    createdAt: event.created_at,
    flowSelected: readString(payload.flow_selected),
    decisionMode: readString(payload.decision_mode),
    continuationUsed: readBoolean(payload.continuation_used),
    saveHintEmitted: readBoolean(payload.save_hint_emitted),
    openFormEmitted: readBoolean(payload.open_form_emitted),
    clarificationKind: readString(payload.clarification_kind),
    flowFinalState: readString(payload.flow_final_state, 'fallback'),
    missingRequiredOpenFieldsCount: readNumber(payload.missing_required_open_fields_count),
    missingSaveHintFieldsCount: readNumber(payload.missing_save_hint_fields_count),
    fieldsPresent: readStringArray(payload.fields_present),
    fieldsMissing: readStringArray(payload.fields_missing),
    llmUsed: readBoolean(payload.llm_used),
  }
}

export function ratio(part: number, total: number): number {
  if (total <= 0) return 0
  return part / total
}

export function classifyLowerBetter(
  value: number,
  threshold: { goodMax: number; warningMax: number }
): AiHealthStatus {
  if (value <= threshold.goodMax) return 'good'
  if (value <= threshold.warningMax) return 'warning'
  return 'risk'
}

export function classifyHigherBetter(
  value: number,
  threshold: { goodMin: number; warningMin: number }
): AiHealthStatus {
  if (value >= threshold.goodMin) return 'good'
  if (value >= threshold.warningMin) return 'warning'
  return 'risk'
}

export function classifyRange(
  value: number,
  threshold: { goodMin: number; goodMax: number; warningMin: number; warningMax: number }
): AiHealthStatus {
  if (value >= threshold.goodMin && value <= threshold.goodMax) return 'good'
  if (value >= threshold.warningMin && value <= threshold.warningMax) return 'warning'
  return 'risk'
}

export function statusWeight(status: AiHealthStatus): number {
  if (status === 'risk') return 2
  if (status === 'warning') return 1
  return 0
}

export function getAiFlowLabel(flow: string): string {
  return AI_FLOW_LABELS[flow] ?? flow
}

export function getAiDecisionModeLabel(mode: string): string {
  return AI_DECISION_MODE_LABELS[mode] ?? mode
}

export function getAiClarificationKindLabel(kind: string): string {
  return AI_CLARIFICATION_KIND_LABELS[kind] ?? kind
}

export function getAiFlowFinalStateLabel(state: string): string {
  return AI_FLOW_FINAL_STATE_LABELS[state] ?? state
}

export function compareAiFlows(a: string, b: string): number {
  const orderA = AI_FLOW_ORDER.indexOf(a)
  const orderB = AI_FLOW_ORDER.indexOf(b)
  if (orderA !== -1 || orderB !== -1) {
    if (orderA === -1) return 1
    if (orderB === -1) return -1
    return orderA - orderB
  }
  return a.localeCompare(b, 'ro')
}

export function compareAiDecisionModes(a: string, b: string): number {
  const orderA = AI_DECISION_MODE_ORDER.indexOf(a)
  const orderB = AI_DECISION_MODE_ORDER.indexOf(b)
  if (orderA !== -1 || orderB !== -1) {
    if (orderA === -1) return 1
    if (orderB === -1) return -1
    return orderA - orderB
  }
  return a.localeCompare(b, 'ro')
}

export type DistributionEntry = {
  key: string
  label: string
  count: number
  share: number
}

export function buildDistributionEntries(
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
