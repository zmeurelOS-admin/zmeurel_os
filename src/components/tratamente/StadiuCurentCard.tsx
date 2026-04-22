'use client'

import { format, parseISO } from 'date-fns'
import { ro } from 'date-fns/locale'
import { LineChart, Sparkles } from 'lucide-react'

import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import type { StadiuFenologicParcela } from '@/lib/supabase/queries/tratamente'
import type { Cohorta, ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { getCohortaLabel, getLabelStadiuContextual } from '@/lib/tratamente/configurare-sezon'
import {
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
} from '@/lib/tratamente/stadii-canonic'

export interface StageState {
  cohort: Cohorta | null
  stadiuCurent: StadiuFenologicParcela | null
  stadiuProgress: number
  stadiuUrmator: string | null
}

interface StadiuCurentCardProps {
  grupBiologic?: GrupBiologic | null
  configurareSezon?: ConfigurareSezon | null
  singleStageState?: StageState | null
  dualStageState?: { floricane: StageState; primocane: StageState } | null
  stadiuCurent?: StadiuFenologicParcela | null
  stadiuProgress?: number
  stadiuUrmator?: string | null
  onRecord: (cohort?: Cohorta) => void
}

function getStadiuLabel(
  stadiu: string | null | undefined,
  configurareSezon: ConfigurareSezon | null,
  grupBiologic?: GrupBiologic | null,
  cohort?: Cohorta | null
): string {
  if (!stadiu) return 'Fără stadiu'
  const cod = normalizeStadiu(stadiu)
  return cod ? getLabelStadiuContextual(cod, configurareSezon, { grupBiologic, cohort }) : stadiu
}

function formatObservedLabel(stadiuCurent: StadiuFenologicParcela): string {
  const sursa =
    stadiuCurent.sursa === 'manual'
      ? 'manual'
      : stadiuCurent.sursa === 'gdd'
        ? 'GDD'
        : stadiuCurent.sursa === 'poza'
          ? 'poză'
          : 'automat'

  return `Observat ${format(parseISO(stadiuCurent.data_observata), 'd MMM', { locale: ro })}, ${sursa}`
}

function renderEmptyStageCard(
  grupBiologic: GrupBiologic | null | undefined,
  configurareSezon: ConfigurareSezon | null | undefined,
  cohort: Cohorta | null,
  onRecord: (cohort?: Cohorta) => void
) {
  const stadiiStart = listStadiiPentruGrup(grupBiologic).slice(0, 2)
  const primaryStart = stadiiStart[0] ?? 'repaus_vegetativ'
  const secondaryStart = stadiiStart[1] ?? 'umflare_muguri'

  return (
    <AppCard className="rounded-2xl border-l-4 border-l-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_7%,var(--surface-card))]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--agri-primary)_14%,var(--surface-card))] text-[var(--agri-primary)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--text-secondary)] [font-weight:650]">
            {cohort ? `Stadiu curent · ${getCohortaLabel(cohort)}` : 'Stadiu curent'}
          </p>
          <p className="mt-1 text-base font-medium text-[var(--text-primary)]">
            Nu ai înregistrat niciun stadiu anul acesta.
          </p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Începe cu{' '}
            <span className="font-medium text-[var(--text-primary)]">
              {getLabelStadiuContextual(primaryStart, configurareSezon ?? null, {
                grupBiologic,
                cohort,
              })}
            </span>{' '}
            sau{' '}
            <span className="font-medium text-[var(--text-primary)]">
              {getLabelStadiuContextual(secondaryStart, configurareSezon ?? null, {
                grupBiologic,
                cohort,
              })}
            </span>
            .
          </p>
          <Button type="button" size="sm" className="mt-4 bg-[var(--agri-primary)] text-white" onClick={() => onRecord(cohort ?? undefined)}>
            Înregistrează primul stadiu
          </Button>
        </div>
      </div>
    </AppCard>
  )
}

function renderStageCard(
  stage: StageState,
  grupBiologic: GrupBiologic | null | undefined,
  configurareSezon: ConfigurareSezon | null | undefined,
  onRecord: (cohort?: Cohorta) => void
) {
  if (!stage.stadiuCurent) {
    return null
  }

  return (
    <AppCard className="rounded-2xl border-l-4 border-l-[var(--agri-primary)] bg-[color:color-mix(in_srgb,var(--agri-primary)_7%,var(--surface-card))]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-[var(--text-secondary)] [font-weight:650]">
            {stage.cohort ? `Stadiu curent · ${getCohortaLabel(stage.cohort)}` : 'Stadiu curent'}
          </p>
          <h2 className="mt-1 text-xl leading-tight text-[var(--text-primary)] [font-weight:750]">
            {getStadiuLabel(stage.stadiuCurent.stadiu, configurareSezon ?? null, grupBiologic, stage.cohort)}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{formatObservedLabel(stage.stadiuCurent)}</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => onRecord(stage.cohort ?? undefined)}>
          Actualizează stadiu
        </Button>
      </div>

      <div className="mt-4 rounded-2xl bg-[var(--surface-card)]/80 p-3 shadow-[var(--shadow-soft)]">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <LineChart className="h-3.5 w-3.5" />
            Progres fenologic
          </span>
          <span>{stage.stadiuProgress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--agri-primary)_12%,var(--surface-card))]">
          <div
            className="h-full rounded-full bg-[var(--agri-primary)] transition-[width] duration-300"
            style={{ width: `${stage.stadiuProgress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          {stage.stadiuUrmator
            ? `Următorul stadiu: ${getStadiuLabel(stage.stadiuUrmator, configurareSezon ?? null, grupBiologic, stage.cohort)}`
            : 'Parcela este deja în ultimul stadiu definit pentru acest an.'}
        </p>
      </div>
    </AppCard>
  )
}

export function StadiuCurentCard({
  grupBiologic,
  configurareSezon,
  singleStageState,
  dualStageState,
  stadiuCurent,
  stadiuProgress = 0,
  stadiuUrmator = null,
  onRecord,
}: StadiuCurentCardProps) {
  const fallbackSingleState =
    singleStageState ??
    ({
      cohort: null,
      stadiuCurent: stadiuCurent ?? null,
      stadiuProgress,
      stadiuUrmator,
    } satisfies StageState)

  if (dualStageState) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {dualStageState.floricane.stadiuCurent
          ? renderStageCard(dualStageState.floricane, grupBiologic, configurareSezon, onRecord)
          : renderEmptyStageCard(grupBiologic, configurareSezon, 'floricane', onRecord)}
        {dualStageState.primocane.stadiuCurent
          ? renderStageCard(dualStageState.primocane, grupBiologic, configurareSezon, onRecord)
          : renderEmptyStageCard(grupBiologic, configurareSezon, 'primocane', onRecord)}
      </div>
    )
  }

  if (!fallbackSingleState.stadiuCurent) {
    return renderEmptyStageCard(grupBiologic, configurareSezon, null, onRecord)
  }

  return renderStageCard(fallbackSingleState, grupBiologic, configurareSezon, onRecord)
}
