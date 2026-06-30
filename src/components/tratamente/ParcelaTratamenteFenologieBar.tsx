import type { StageState } from '@/components/tratamente/StadiuCurentCard'
import type { ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { getCohortaLabel, getLabelStadiuContextual } from '@/lib/tratamente/configurare-sezon'
import { normalizeStadiu, type GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import { cn } from '@/lib/utils'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'

type ParcelaTratamenteFenologieBarProps = {
  configurareSezon: ConfigurareSezon | null
  dualStageState: { floricane: StageState; primocane: StageState } | null
  grupBiologic?: GrupBiologic | null
  singleStageState: StageState | null
}

function stageChipLabel(
  stage: StageState,
  configurareSezon: ConfigurareSezon | null,
  grupBiologic: GrupBiologic | null | undefined,
  cohort?: Cohorta
): string {
  const cod = stage.stadiuCurent?.stadiu ? normalizeStadiu(stage.stadiuCurent.stadiu) : null
  if (!cod) return 'Fenofază neînregistrată'
  return getLabelStadiuContextual(cod, configurareSezon, { grupBiologic, cohort })
}

export function ParcelaTratamenteFenologieBar({
  configurareSezon,
  dualStageState,
  grupBiologic,
  singleStageState,
}: ParcelaTratamenteFenologieBarProps) {
  if (dualStageState) {
    return (
      <div className="flex flex-wrap gap-2 pt-1">
        {(['floricane', 'primocane'] as const).map((cohort) => {
          const stage = dualStageState[cohort]
          const isFloricane = cohort === 'floricane'
          return (
            <span
              key={cohort}
              className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
                isFloricane
                  ? 'border-[color:color-mix(in_srgb,var(--agri-primary)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--agri-primary)_8%,var(--surface-card))] text-[var(--agri-primary)]'
                  : 'border-[color:color-mix(in_srgb,var(--status-info-text)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--status-info-text)_8%,var(--surface-card))] text-[var(--status-info-text)]'
              )}
            >
              <span aria-hidden>{isFloricane ? '🌸' : '🌱'}</span>
              <span className="truncate">
                {getCohortaLabel(cohort)}: {stageChipLabel(stage, configurareSezon, grupBiologic, cohort)}
              </span>
            </span>
          )
        })}
      </div>
    )
  }

  if (!singleStageState) return null

  return (
    <div className="pt-1">
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">
        <span aria-hidden>🌿</span>
        <span className="truncate">
          Fenofază: {stageChipLabel(singleStageState, configurareSezon, grupBiologic)}
        </span>
      </span>
    </div>
  )
}
