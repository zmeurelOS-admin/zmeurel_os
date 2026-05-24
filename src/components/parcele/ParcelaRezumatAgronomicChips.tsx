'use client'

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { AppSelect } from '@/components/ui/app-select'
import { getStadiuOptions } from '@/components/tratamente/plan-wizard/helpers'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { queryKeys } from '@/lib/query-keys'
import {
  createParcelaStadiuCanonic,
  getConfigurareSezonParcela,
  getStadiiCanoniceParcela,
  type ConfigurareParcelaSezon,
  type ParcelaStadiuCanonic,
} from '@/lib/supabase/queries/parcela-stadii'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import { formatStadiuOptionLabel } from '@/lib/ui/app-select-maps'
import {
  getGrupBiologicForCropCod,
  getLabelPentruGrup,
  getOrdine,
  getOrdineInGrup,
  listAllStadiiCanonice,
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'
import { toast } from '@/lib/ui/toast'
import { getCurrentSezon } from '@/lib/utils/sezon'
import { cn } from '@/lib/utils'

const CHIP_TRIGGER_CLASS =
  'h-8 min-h-8 rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-3 text-xs font-semibold text-[var(--agri-text)] shadow-none'

function getStadiuOrder(cod: StadiuCod, grupBiologic: GrupBiologic | null): number {
  if (grupBiologic) {
    const indexInGroup = getOrdineInGrup(cod, grupBiologic)
    if (indexInGroup >= 0) return indexInGroup
  }
  return getOrdine(cod) + 100
}

export function getCurrentCanonicalStage(
  stages: ParcelaStadiuCanonic[],
  grupBiologic: GrupBiologic | null
): ParcelaStadiuCanonic | null {
  if (stages.length === 0) return null

  return [...stages].sort((a, b) => {
    const codA = normalizeStadiu(a.stadiu)
    const codB = normalizeStadiu(b.stadiu)
    const orderA = codA ? getStadiuOrder(codA, grupBiologic) : Number.MIN_SAFE_INTEGER
    const orderB = codB ? getStadiuOrder(codB, grupBiologic) : Number.MIN_SAFE_INTEGER
    const orderDiff = orderB - orderA
    if (orderDiff !== 0) return orderDiff

    const observedDiff = new Date(b.data_observata).getTime() - new Date(a.data_observata).getTime()
    if (observedDiff !== 0) return observedDiff

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })[0] ?? null
}

export function getCurrentCanonicalStageForCohort(
  stages: ParcelaStadiuCanonic[],
  grupBiologic: GrupBiologic | null,
  cohort: Cohorta
): ParcelaStadiuCanonic | null {
  return getCurrentCanonicalStage(
    stages.filter((entry) => entry.cohort === cohort),
    grupBiologic
  )
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return 'A apărut o eroare neașteptată.'
}

function AgronomicStadiuChip({
  parcelaId,
  chipId,
  cohort,
  cohortLabel,
  grupBiologic,
  canonicalStages,
  seasonConfig,
}: {
  parcelaId: string
  chipId: string
  cohort: Cohorta | null
  cohortLabel?: string
  grupBiologic: GrupBiologic | null
  canonicalStages: ParcelaStadiuCanonic[]
  seasonConfig: ConfigurareParcelaSezon | null
}) {
  const queryClient = useQueryClient()
  const currentSezon = getCurrentSezon()

  const currentStage = useMemo(
    () =>
      cohort
        ? getCurrentCanonicalStageForCohort(canonicalStages, grupBiologic, cohort)
        : getCurrentCanonicalStage(canonicalStages, grupBiologic),
    [canonicalStages, cohort, grupBiologic]
  )

  const stageOptions = useMemo(() => {
    const values = grupBiologic ? listStadiiPentruGrup(grupBiologic) : listAllStadiiCanonice()
    const emojiByCod = Object.fromEntries(
      getStadiuOptions(grupBiologic).map((option) => [option.value, option.emoji])
    )
    return values.map((cod) => ({
      value: cod,
      label: getLabelPentruGrup(cod, grupBiologic, { cohort }),
      emoji: emojiByCod[cod],
    }))
  }, [cohort, grupBiologic])

  const hasCanonicalCohorts = useMemo(
    () => canonicalStages.some((entry) => entry.cohort === 'floricane' || entry.cohort === 'primocane'),
    [canonicalStages]
  )
  const isRubusMixt =
    grupBiologic === 'rubus' &&
    (seasonConfig?.sistem_conducere === 'mixt_floricane_primocane' || hasCanonicalCohorts)

  const saveMutation = useMutation({
    mutationFn: (stadiu: string) => {
      if (!stadiu) throw new Error('Selectează un stadiu')
      if (isRubusMixt && !cohort) throw new Error('Selectează cohorta')
      const today = new Date().toISOString().slice(0, 10)
      return createParcelaStadiuCanonic({
        parcela_id: parcelaId,
        an: currentSezon,
        stadiu,
        cohort: cohort ?? null,
        data_observata: today,
      })
    },
    onSuccess: () => {
      toast.success('Stadiu salvat')
      queryClient.invalidateQueries({ queryKey: queryKeys.parcelaCultureStages(parcelaId) })
    },
    onError: (err: unknown) => toast.error(toErrorMessage(err)),
  })

  const selectedValue = currentStage?.stadiu ? normalizeStadiu(currentStage.stadiu) ?? currentStage.stadiu : ''

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {cohortLabel ? (
        <span className="shrink-0 rounded-full border border-[var(--surface-divider)] bg-[var(--agri-surface)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--agri-text-muted)]">
          {cohortLabel}
        </span>
      ) : null}
      <AppSelect
        id={chipId}
        placeholder="Setează stadiul"
        value={selectedValue}
        options={stageOptions}
        showSearchThreshold={14}
        disabled={saveMutation.isPending}
        getOptionDisplayLabel={formatStadiuOptionLabel}
        triggerClassName={cn(CHIP_TRIGGER_CLASS, 'min-w-[9.5rem] flex-1')}
        onChange={(nextValue) => {
          if (!nextValue || nextValue === selectedValue) return
          saveMutation.mutate(nextValue)
        }}
      />
    </div>
  )
}

export function ParcelaRezumatAgronomicChips({ parcela }: { parcela: Parcela }) {
  const parcelaId = parcela.id
  const currentSezon = getCurrentSezon()
  const parcelaCropCod = useMemo(
    () => normalizeCropCod(parcela.cultura) ?? normalizeCropCod(parcela.tip_fruct),
    [parcela.cultura, parcela.tip_fruct]
  )
  const grupBiologic = useMemo(() => getGrupBiologicForCropCod(parcelaCropCod), [parcelaCropCod])

  const { data: canonicalStages = [] } = useQuery({
    queryKey: queryKeys.parcelaCultureStages(parcelaId),
    queryFn: () => getStadiiCanoniceParcela(parcelaId, currentSezon, 50),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: Boolean(parcelaId),
  })

  const { data: seasonConfig = null } = useQuery({
    queryKey: queryKeys.parcelaSeasonConfig(parcelaId, currentSezon),
    queryFn: () => getConfigurareSezonParcela(parcelaId, currentSezon),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: Boolean(parcelaId),
  })

  const hasCanonicalCohorts = useMemo(
    () => canonicalStages.some((entry) => entry.cohort === 'floricane' || entry.cohort === 'primocane'),
    [canonicalStages]
  )
  const isRubusMixt =
    grupBiologic === 'rubus' &&
    (seasonConfig?.sistem_conducere === 'mixt_floricane_primocane' || hasCanonicalCohorts)

  if (!parcelaCropCod && canonicalStages.length === 0) {
    return null
  }

  if (isRubusMixt) {
    return (
      <div className="mb-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Fenologie</p>
        <AgronomicStadiuChip
          parcelaId={parcelaId}
          chipId={`parcela-rezumat-stadiu-floricane-${parcelaId}`}
          cohort="floricane"
          cohortLabel="Floricane"
          grupBiologic={grupBiologic}
          canonicalStages={canonicalStages}
          seasonConfig={seasonConfig}
        />
        <AgronomicStadiuChip
          parcelaId={parcelaId}
          chipId={`parcela-rezumat-stadiu-primocane-${parcelaId}`}
          cohort="primocane"
          cohortLabel="Primocane"
          grupBiologic={grupBiologic}
          canonicalStages={canonicalStages}
          seasonConfig={seasonConfig}
        />
      </div>
    )
  }

  return (
    <div className="mb-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Fenologie</p>
      <AgronomicStadiuChip
        parcelaId={parcelaId}
        chipId={`parcela-rezumat-stadiu-${parcelaId}`}
        cohort={null}
        grupBiologic={grupBiologic}
        canonicalStages={canonicalStages}
        seasonConfig={seasonConfig}
      />
    </div>
  )
}
