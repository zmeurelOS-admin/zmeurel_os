'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { AppSelect } from '@/components/ui/app-select'
import { getStadiuOptions } from '@/components/tratamente/plan-wizard/helpers'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { queryKeys } from '@/lib/query-keys'
import {
  createParcelaStadiuCanonic,
  getConfigurareSezonParcela,
  getStadiiCanoniceParcela,
  mergeParcelaStadiuInList,
  type ConfigurareParcelaSezon,
  type ParcelaStadiuCanonic,
} from '@/lib/supabase/queries/parcela-stadii'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import {
  isParcelaRubusMixtFenologie,
  resolveStadiuFenologicCurentParcela,
} from '@/lib/tratamente/fenofaza-curenta-parcela'
import {
  getGrupBiologicForCropCod,
  getLabelPentruGrup,
  listAllStadiiCanonice,
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
} from '@/lib/tratamente/stadii-canonic'
import { toast } from '@/lib/ui/toast'
import { getCurrentSezon } from '@/lib/utils/sezon'
import { cn } from '@/lib/utils'

const CHIP_TRIGGER_CLASS =
  'h-8 min-h-8 rounded-full border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-3 text-xs font-semibold text-[var(--agri-text)] shadow-none'

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
  const router = useRouter()
  const currentSezon = getCurrentSezon()

  const currentStage = useMemo(
    () => resolveStadiuFenologicCurentParcela(canonicalStages, grupBiologic, cohort ?? undefined),
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

  const isRubusMixt = isParcelaRubusMixtFenologie(grupBiologic, seasonConfig, canonicalStages)

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
    onSuccess: async (savedRow) => {
      const cacheKey = queryKeys.parcelaCultureStages(parcelaId)
      queryClient.setQueryData<ParcelaStadiuCanonic[]>(cacheKey, (current) =>
        mergeParcelaStadiuInList(current ?? [], savedRow)
      )
      await queryClient.refetchQueries({ queryKey: cacheKey, type: 'active' })
      toast.success('Stadiu salvat')
      router.refresh()
    },
    onError: (err: unknown) => toast.error(toErrorMessage(err)),
  })

  const selectedValue = currentStage?.stadiu ? normalizeStadiu(currentStage.stadiu) ?? currentStage.stadiu : ''

  return (
    <div className="flex min-w-0 items-center gap-2">
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
        triggerClassName={cn(CHIP_TRIGGER_CLASS, 'min-w-0 flex-1')}
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

  const isRubusMixt = isParcelaRubusMixtFenologie(grupBiologic, seasonConfig, canonicalStages)

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
