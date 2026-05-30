'use client'

import { useMemo, type CSSProperties } from 'react'

import type { ConfigurareParcelaSezon, ParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'
import { getCohortaLabel, type Cohorta } from '@/lib/tratamente/configurare-sezon'
import {
  isParcelaRubusMixtFenologie,
  resolveStadiiFenologiceCurenteParcela,
  type StadiuFenologicCurentEntry,
} from '@/lib/tratamente/fenofaza-curenta-parcela'
import { getLabelPentruGrup, normalizeStadiu, type GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import { cn } from '@/lib/utils'

export function formatStadiuFenologicLabel(
  stage: ParcelaStadiuCanonic | null | undefined,
  grupBiologic: GrupBiologic | null,
  cohort?: Cohorta | null
): string {
  if (!stage?.stadiu?.trim()) return 'Fără stadiu'
  const cod = normalizeStadiu(stage.stadiu)
  if (cod) return getLabelPentruGrup(cod, grupBiologic, { cohort: cohort ?? stage.cohort })
  const normalized = stage.stadiu.replaceAll('_', ' ').trim()
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function formatStadiuFenologicCurentSummary(
  entries: StadiuFenologicCurentEntry[],
  grupBiologic: GrupBiologic | null,
  options?: { emptyLabel?: string; includeEmptyCohorts?: boolean }
): string {
  const emptyLabel = options?.emptyLabel ?? 'Fără stadiu înregistrat'
  const parts = entries
    .filter((entry) => options?.includeEmptyCohorts || entry.stage)
    .map((entry) => {
      const label = entry.stage
        ? formatStadiuFenologicLabel(entry.stage, grupBiologic, entry.cohort)
        : 'Fără stadiu'
      if (entry.cohort) return `${getCohortaLabel(entry.cohort)}: ${label}`
      return label
    })

  if (parts.length === 0) return emptyLabel
  return parts.join(' · ')
}

const BADGE_PILL_STYLE: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  borderRadius: 20,
  padding: '2px 7px',
  background: 'var(--agri-surface-muted)',
  color: 'var(--agri-text)',
  border: '1px solid var(--agri-border)',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

type ParcelaStadiuCurentDisplayProps = {
  canonicalStages: ParcelaStadiuCanonic[]
  grupBiologic: GrupBiologic | null
  seasonConfig: ConfigurareParcelaSezon | null
  variant?: 'badge' | 'text' | 'detail'
  emptyLabel?: string
  fallbackLabel?: string | null
  className?: string
}

export function ParcelaStadiuCurentDisplay({
  canonicalStages,
  grupBiologic,
  seasonConfig,
  variant = 'text',
  emptyLabel = 'Fără stadiu înregistrat',
  fallbackLabel = null,
  className,
}: ParcelaStadiuCurentDisplayProps) {
  const isRubusMixt = useMemo(
    () => isParcelaRubusMixtFenologie(grupBiologic, seasonConfig, canonicalStages),
    [canonicalStages, grupBiologic, seasonConfig]
  )
  const entries = useMemo(
    () => resolveStadiiFenologiceCurenteParcela(canonicalStages, grupBiologic, isRubusMixt),
    [canonicalStages, grupBiologic, isRubusMixt]
  )
  const hasCanonicalStage = entries.some((entry) => entry.stage)
  const summary = hasCanonicalStage
    ? formatStadiuFenologicCurentSummary(entries, grupBiologic, { emptyLabel })
    : (fallbackLabel ?? emptyLabel)

  if (variant === 'badge') {
    if (!hasCanonicalStage) {
      return (
        <span style={{ ...BADGE_PILL_STYLE, flexShrink: 0 }} className={className}>
          {summary}
        </span>
      )
    }

    if (isRubusMixt) {
      return (
        <div
          className={cn('flex min-w-0 max-w-[46%] shrink flex-col items-end gap-0.5 sm:max-w-[52%]', className)}
          data-testid="stadiu-curent-dual-badge"
        >
          {entries.map(({ cohort, stage }) => (
            <span key={cohort ?? 'mono'} style={BADGE_PILL_STYLE} title={formatStadiuFenologicLabel(stage, grupBiologic, cohort)}>
              {cohort ? `${getCohortaLabel(cohort).slice(0, 4)}: ` : ''}
              {stage ? formatStadiuFenologicLabel(stage, grupBiologic, cohort) : '—'}
            </span>
          ))}
        </div>
      )
    }

    const monoStage = entries[0]?.stage ?? null
    return (
      <span style={{ ...BADGE_PILL_STYLE, flexShrink: 0 }} className={className}>
        {monoStage ? formatStadiuFenologicLabel(monoStage, grupBiologic, entries[0]?.cohort) : summary}
      </span>
    )
  }

  if (variant === 'detail') {
    if (!hasCanonicalStage) {
      return <p className={cn('text-sm font-semibold text-[var(--agri-text)]', className)}>{summary}</p>
    }

    if (isRubusMixt) {
      return (
        <div className={cn('space-y-2', className)} data-testid="stadiu-curent-dual-detail">
          {entries.map(({ cohort, stage }) => (
            <div key={cohort ?? 'mono'}>
              <p className="text-sm font-semibold text-[var(--agri-text)]">
                {cohort ? `${getCohortaLabel(cohort)}: ` : ''}
                {stage ? formatStadiuFenologicLabel(stage, grupBiologic, cohort) : 'Niciun stadiu înregistrat'}
              </p>
              {stage?.data_observata ? (
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--agri-text-muted)]">
                  Observat la {new Date(stage.data_observata).toLocaleDateString('ro-RO')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )
    }

    const monoStage = entries[0]?.stage ?? null
    return (
      <div className={className}>
        <p className="text-sm font-semibold text-[var(--agri-text)]">
          {monoStage ? formatStadiuFenologicLabel(monoStage, grupBiologic, entries[0]?.cohort) : summary}
        </p>
        {monoStage?.data_observata ? (
          <p className="mt-2 text-[11px] leading-snug text-[var(--agri-text-muted)]">
            Observat la {new Date(monoStage.data_observata).toLocaleDateString('ro-RO')}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <span className={cn('min-w-0 break-words text-inherit', className)} data-testid="stadiu-curent-text">
      {summary}
    </span>
  )
}
