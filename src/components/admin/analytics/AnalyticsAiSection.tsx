import Link from 'next/link'

import { KpiCard } from '@/components/app/KpiCard'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AnalyticsDashboardParams, RawAnalyticsEvent } from '@/lib/admin/analytics-dashboard-data'
import { buildAdminAnalyticsHref } from '@/lib/admin/analytics-url'
import {
  AI_BETA_RATE_THRESHOLDS,
  AI_STATUS_META,
  type AiHealthStatus,
  buildDistributionEntries,
  compareAiDecisionModes,
  compareAiFlows,
  getAiClarificationKindLabel,
  getAiDecisionModeLabel,
  getAiFlowFinalStateLabel,
  getAiFlowLabel,
  parseAiEvent,
  ratio,
  statusWeight,
  type DistributionEntry,
  classifyHigherBetter,
  classifyLowerBetter,
  classifyRange,
} from '@/lib/admin/analytics-ai'

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

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
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

function formatDecimal(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

function DistributionList({ rows, emptyMessage }: { rows: DistributionEntry[]; emptyMessage: string }) {
  const maxCount = rows[0]?.count ?? 1
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center justify-between sm:contents">
            <span className="text-sm font-medium text-[var(--agri-text)] sm:w-36 sm:shrink-0">{row.label}</span>
            <span className="text-xs text-muted-foreground sm:hidden">{formatPercent(row.share)}</span>
          </div>
          <div className="flex flex-1 items-center gap-2">
            <div className="flex-1 overflow-hidden rounded-full bg-[var(--agri-surface-muted)]">
              <div
                className="h-4 rounded-full bg-emerald-500"
                style={{ width: `${Math.max(4, Math.round((row.count / maxCount) * 100))}%` }}
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
    <Button asChild size="sm" variant={active ? 'default' : 'outline'} className="h-8 rounded-md text-xs">
      <Link href={href}>{label}</Link>
    </Button>
  )
}

export function AnalyticsAiSection({
  eventsRaw,
  params,
}: {
  eventsRaw: RawAnalyticsEvent[]
  params: AnalyticsDashboardParams
}) {
  const aiEventsInRange = eventsRaw.map(parseAiEvent).filter((e): e is NonNullable<typeof e> => Boolean(e))

  const aiFlowOptions = Array.from(new Set(aiEventsInRange.map((e) => e.flowSelected))).sort(compareAiFlows)
  const aiDecisionModeOptions = Array.from(new Set(aiEventsInRange.map((e) => e.decisionMode))).sort(
    compareAiDecisionModes
  )
  const aiEvents = aiEventsInRange.filter((event) => {
    if (params.aiFlow && event.flowSelected !== params.aiFlow) return false
    if (params.aiDecisionMode && event.decisionMode !== params.aiDecisionMode) return false
    return true
  })

  const totalAiInteractions = aiEvents.length
  const aiOpenFormCount = aiEvents.filter((e) => e.openFormEmitted).length
  const aiClarificationCount = aiEvents.filter((e) => e.flowFinalState === 'clarify').length
  const aiLlmFallbackCount = aiEvents.filter((e) => e.decisionMode === 'llm_fallback').length
  const aiSaveHintCount = aiEvents.filter((e) => e.saveHintEmitted).length
  const aiContinuationCount = aiEvents.filter((e) => e.continuationUsed).length

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

  const aiFlowDistribution = buildDistributionEntries(aiFlowCounts, totalAiInteractions, getAiFlowLabel).sort(
    (a, b) => b.count - a.count || compareAiFlows(a.key, b.key)
  )
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
    .sort(
      (a, b) =>
        b.clarifications - a.clarifications ||
        b.clarificationRate - a.clarificationRate ||
        compareAiFlows(a.flow, b.flow)
    )

  const aiSaveHintRows = Array.from(aiSaveHintMap.values())
    .map((row) => ({
      ...row,
      saveHintRate: ratio(row.saveHints, row.total),
      avgMissingSaveHint: row.saveHints > 0 ? row.avgMissingSaveHint / row.saveHints : 0,
    }))
    .sort(
      (a, b) => b.saveHints - a.saveHints || b.saveHintRate - a.saveHintRate || compareAiFlows(a.flow, b.flow)
    )

  const aiLlmRows = Array.from(aiLlmMap.values())
    .map((row) => ({
      ...row,
      llmRate: ratio(row.llmCount, row.total),
    }))
    .sort((a, b) => b.llmCount - a.llmCount || b.llmRate - a.llmRate || compareAiFlows(a.flow, b.flow))

  const aiRecentEvents = aiEvents.slice(0, 15)

  const aiOpenFormRate = ratio(aiOpenFormCount, totalAiInteractions)
  const aiClarificationRate = ratio(aiClarificationCount, totalAiInteractions)
  const aiLlmFallbackRate = ratio(aiLlmFallbackCount, totalAiInteractions)
  const aiSaveHintRate = ratio(aiSaveHintCount, totalAiInteractions)
  const aiContinuationRate = ratio(aiContinuationCount, totalAiInteractions)
  const avgMissingRequiredOpenForClarify =
    aiClarificationCount > 0
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
    aiNeedsAttentionNow.push({ severity: aiKpiHealth.llmFallbackRate, text: 'Fallback AI peste pragul beta.' })
  }
  if (aiKpiHealth.clarificationRate !== 'good') {
    aiNeedsAttentionNow.push({ severity: aiKpiHealth.clarificationRate, text: 'Clarificări peste pragul beta.' })
  }
  if (aiKpiHealth.openFormRate !== 'good') {
    aiNeedsAttentionNow.push({ severity: aiKpiHealth.openFormRate, text: 'Rată open_form sub țintă.' })
  }
  if (aiKpiHealth.saveHintRate !== 'good') {
    aiNeedsAttentionNow.push({ severity: aiKpiHealth.saveHintRate, text: 'Save hints frecvente.' })
  }
  aiNeedsAttentionNow.sort((a, b) => statusWeight(b.severity) - statusWeight(a.severity))

  const aiFrictionStatusByFlow = new Map<string, AiHealthStatus>(
    aiFrictionRows.map((row) => [
      row.flow,
      classifyLowerBetter(row.clarificationRate, AI_BETA_RATE_THRESHOLDS.clarificationRate),
    ])
  )

  return (
    <Card className="rounded-xl border border-[var(--agri-border)] border-dashed bg-[var(--agri-surface-muted)]/40 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold tracking-tight text-[var(--agri-text)]">
          Telemetrie AI & debug
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Beta: decizii structurate din `ai_chat_decision`. Nu conține mesaje brute utilizator.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <FilterLink
            href={buildAdminAnalyticsHref(params, { aiRange: '7d' })}
            label="AI 7 zile"
            active={params.aiRange === '7d'}
          />
          <FilterLink
            href={buildAdminAnalyticsHref(params, { aiRange: '30d' })}
            label="AI 30 zile"
            active={params.aiRange === '30d'}
          />
          <FilterLink href={buildAdminAnalyticsHref(params, { aiFlow: null })} label="Toate flow-urile" active={!params.aiFlow} />
          {aiFlowOptions.map((flow) => (
            <FilterLink
              key={flow}
              href={buildAdminAnalyticsHref(params, { aiFlow: flow })}
              label={getAiFlowLabel(flow)}
              active={params.aiFlow === flow}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterLink
            href={buildAdminAnalyticsHref(params, { aiDecisionMode: null })}
            label="Toate mode-urile"
            active={!params.aiDecisionMode}
          />
          {aiDecisionModeOptions.map((mode) => (
            <FilterLink
              key={mode}
              href={buildAdminAnalyticsHref(params, { aiDecisionMode: mode })}
              label={getAiDecisionModeLabel(mode)}
              active={params.aiDecisionMode === mode}
            />
          ))}
        </div>

        {totalAiInteractions === 0 ? (
          <p className="text-sm text-muted-foreground">Nu există evenimente `ai_chat_decision` în interval.</p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
              <KpiCard
                title="Interacțiuni"
                value={totalAiInteractions}
                subtitle="după filtre"
                trend="neutral"
              />
              <KpiCard
                title="Open form"
                value={formatPercent(aiOpenFormRate)}
                trend={AI_STATUS_META[aiKpiHealth.openFormRate].trend}
                icon={<span className="text-[10px] font-semibold">{AI_STATUS_META[aiKpiHealth.openFormRate].label}</span>}
              />
              <KpiCard
                title="Clarificări"
                value={formatPercent(aiClarificationRate)}
                trend={AI_STATUS_META[aiKpiHealth.clarificationRate].trend}
                icon={<span className="text-[10px] font-semibold">{AI_STATUS_META[aiKpiHealth.clarificationRate].label}</span>}
              />
              <KpiCard
                title="LLM fallback"
                value={formatPercent(aiLlmFallbackRate)}
                trend={AI_STATUS_META[aiKpiHealth.llmFallbackRate].trend}
                icon={<span className="text-[10px] font-semibold">{AI_STATUS_META[aiKpiHealth.llmFallbackRate].label}</span>}
              />
              <KpiCard
                title="Save hints"
                value={formatPercent(aiSaveHintRate)}
                trend={AI_STATUS_META[aiKpiHealth.saveHintRate].trend}
                icon={<span className="text-[10px] font-semibold">{AI_STATUS_META[aiKpiHealth.saveHintRate].label}</span>}
              />
              <KpiCard
                title="Continuation"
                value={formatPercent(aiContinuationRate)}
                trend={AI_STATUS_META[aiKpiHealth.continuationRate].trend}
                icon={<span className="text-[10px] font-semibold">{AI_STATUS_META[aiKpiHealth.continuationRate].label}</span>}
              />
            </section>

            {aiNeedsAttentionNow.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                <p className="font-semibold">Semnale</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {aiNeedsAttentionNow.slice(0, 4).map((item) => (
                    <li key={item.text}>{item.text}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--agri-border)] bg-[var(--agri-surface)] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flow-uri</p>
                <DistributionList rows={aiFlowDistribution} emptyMessage="—" />
              </div>
              <div className="rounded-lg border border-[var(--agri-border)] bg-[var(--agri-surface)] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision mode</p>
                <DistributionList rows={aiDecisionModeDistribution} emptyMessage="—" />
              </div>
            </div>

            {topAiClarificationKinds.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {topAiClarificationKinds.map((item) => (
                  <span
                    key={item.key}
                    className="inline-flex rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-2.5 py-1 text-xs font-medium"
                  >
                    {item.label}: {item.count}
                  </span>
                ))}
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-[var(--agri-border)]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Flow</TableHead>
                    <TableHead className="text-right">Clarificări</TableHead>
                    <TableHead className="text-right">% clarify</TableHead>
                    <TableHead className="text-right">Medie lipsuri</TableHead>
                    <TableHead className="text-right">Semnal</TableHead>
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
                      <TableCell className="text-right">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${AI_STATUS_META[aiFrictionStatusByFlow.get(row.flow) ?? 'good'].className}`}
                        >
                          {AI_STATUS_META[aiFrictionStatusByFlow.get(row.flow) ?? 'good'].label}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[var(--agri-border)]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Flow</TableHead>
                    <TableHead className="text-right">Save hints</TableHead>
                    <TableHead className="text-right">Rată</TableHead>
                    <TableHead className="text-right">Medie lipsuri save</TableHead>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[var(--agri-border)]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Flow</TableHead>
                    <TableHead className="text-right">LLM</TableHead>
                    <TableHead className="text-right">Rată</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiLlmRows.map((row) => (
                    <TableRow key={row.flow}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.llmCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(row.llmRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[var(--agri-border)]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Timp</TableHead>
                    <TableHead>Flow</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead>Open</TableHead>
                    <TableHead>LLM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiRecentEvents.map((event, index) => (
                    <TableRow key={`${event.createdAt}-${index}`}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(event.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{getAiFlowLabel(event.flowSelected)}</TableCell>
                      <TableCell className="text-xs">{getAiDecisionModeLabel(event.decisionMode)}</TableCell>
                      <TableCell className="text-xs">{getAiFlowFinalStateLabel(event.flowFinalState)}</TableCell>
                      <TableCell className="text-xs">{event.openFormEmitted ? 'Da' : 'Nu'}</TableCell>
                      <TableCell className="text-xs">{event.llmUsed ? 'Da' : 'Nu'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
