import { endOfYear, startOfYear } from 'date-fns'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { ParcelaTratamenteHeader } from '@/components/tratamente/ParcelaTratamenteHeader'
import { ParcelaTratamenteDashboardClient } from '@/components/tratamente/ParcelaTratamenteDashboardClient'
import type { StageState } from '@/components/tratamente/StadiuCurentCard'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import {
  getGrupBiologicParcela,
  getParcelaTratamenteContext,
  getPlanActivPentruParcela,
  listAplicariParcela,
  listInterventiiRelevanteParcela,
  listPlanuriTratament,
  listProduseFitosanitare,
  listStadiiPentruParcela,
  type AplicareTratamentDetaliu,
  type InterventieRelevantaV2,
  type ParcelaTratamenteContext,
  type PlanActivParcela,
  type PlanTratament,
  type ProdusFitosanitar,
  type StadiuFenologicParcela,
} from '@/lib/supabase/queries/tratamente'
import {
  getOrCreateConfigurareSezon,
  getParcelaPentruConfigurareSezon,
} from '@/lib/supabase/queries/configurari-sezon'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import { isRubusMixt } from '@/lib/tratamente/configurare-sezon'
import { genereazaAplicariPentruParcela } from '@/lib/tratamente/generator/generator'
import {
  getOrdine,
  getOrdineInGrup,
  getStadiuUrmatorInGrup,
  listStadiiPentruGrup,
  normalizeStadiu,
  type GrupBiologic,
} from '@/lib/tratamente/stadii-canonic'
import { getStadiulUrmator } from '@/lib/tratamente/stadiu-ordering'
import { getCurrentSezon } from '@/lib/utils/sezon'

type PageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function getParcelaCultureHint(parcela: ParcelaTratamenteContext): string | null {
  const values = [parcela.cultura, parcela.tip_fruct]
    .map((value) => normalizeCropCod(value) ?? normalizeText(value))
    .filter(Boolean)

  return values[0] ?? null
}

function filterPlanuriDisponibile(planuri: PlanTratament[], parcela: ParcelaTratamenteContext): PlanTratament[] {
  const culturaHint = getParcelaCultureHint(parcela)
  if (!culturaHint) {
    return planuri
  }

  const matched = planuri.filter((plan) => normalizeText(plan.cultura_tip) === culturaHint)
  return matched.length > 0 ? matched : planuri
}

function getStadiuCurent(
  stadii: StadiuFenologicParcela[],
  grupBiologic: GrupBiologic | null,
  cohort?: Cohorta
): StadiuFenologicParcela | null {
  const stadiiFiltrate = cohort ? stadii.filter((stadiu) => stadiu.cohort === cohort) : stadii
  if (stadiiFiltrate.length === 0) return null

  return [...stadiiFiltrate].sort((a, b) => {
    const observedDiff = new Date(b.data_observata).getTime() - new Date(a.data_observata).getTime()
    if (observedDiff !== 0) return observedDiff

    const codA = normalizeStadiu(a.stadiu)
    const codB = normalizeStadiu(b.stadiu)
    const ordineA = codA ? resolveStadiuOrder(codA, grupBiologic) : Number.MIN_SAFE_INTEGER
    const ordineB = codB ? resolveStadiuOrder(codB, grupBiologic) : Number.MIN_SAFE_INTEGER
    const ordineDiff = ordineB - ordineA
    if (ordineDiff !== 0) return ordineDiff

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })[0] ?? null
}

function resolveStadiuOrder(cod: ReturnType<typeof normalizeStadiu>, grupBiologic: GrupBiologic | null): number {
  if (!cod) return Number.MIN_SAFE_INTEGER
  if (grupBiologic) {
    const inGroup = getOrdineInGrup(cod, grupBiologic)
    if (inGroup >= 0) return inGroup
  }
  return getOrdine(cod) + 100
}

function getStadiuProgress(stadiu: string | null, grupBiologic: GrupBiologic | null): number {
  if (!stadiu) return 0

  const cod = normalizeStadiu(stadiu)
  if (!cod) return 0

  const stadiiSortate = listStadiiPentruGrup(grupBiologic)
  const index = stadiiSortate.findIndex((value) => value === cod)
  if (index === -1) return 0
  if (stadiiSortate.length === 1) return 100
  return Math.round((index / (stadiiSortate.length - 1)) * 100)
}

function buildStageState(
  stadii: StadiuFenologicParcela[],
  grupBiologic: GrupBiologic | null,
  cohort: Cohorta | null
): StageState {
  const stadiuCurent = getStadiuCurent(stadii, grupBiologic, cohort ?? undefined)
  const stadiuCurentCod = stadiuCurent ? normalizeStadiu(stadiuCurent.stadiu) : null
  const stadiuUrmator =
    stadiuCurentCod && grupBiologic
      ? getStadiuUrmatorInGrup(stadiuCurentCod, grupBiologic)
      : stadiuCurent
        ? getStadiulUrmator(stadiuCurent.stadiu)
        : null

  return {
    cohort,
    stadiuCurent,
    stadiuProgress: getStadiuProgress(stadiuCurent?.stadiu ?? null, grupBiologic),
    stadiuUrmator,
  }
}

function sortAplicariAsc(aplicari: AplicareTratamentDetaliu[]): AplicareTratamentDetaliu[] {
  return [...aplicari].sort((a, b) => {
    const first = new Date(a.data_planificata ?? a.created_at).getTime()
    const second = new Date(b.data_planificata ?? b.created_at).getTime()
    return first - second
  })
}

function getPlanDetailsHref(planActiv: PlanActivParcela | null): string | null {
  return planActiv?.plan?.id ? `/tratamente/planuri/${planActiv.plan.id}` : null
}

function getPlanEditHref(planActiv: PlanActivParcela | null): string | null {
  return planActiv?.plan?.id ? `/tratamente/planuri/${planActiv.plan.id}/editeaza` : null
}

export default async function ParcelaTratamentePage({ params }: PageProps) {
  const { id: parcelaId } = await params
  const an = getCurrentSezon()
  const from = startOfYear(new Date(Date.UTC(an, 0, 1)))
  const to = endOfYear(new Date(Date.UTC(an, 0, 1)))

  const [
    parcela,
    parcelaSezon,
    planActiv,
    stadii,
    aplicari,
    toatePlanurile,
    grupBiologic,
    produseFitosanitare,
    interventiiRelevante,
  ] = await Promise.all([
    getParcelaTratamenteContext(parcelaId),
    getParcelaPentruConfigurareSezon(parcelaId),
    getPlanActivPentruParcela(parcelaId, an),
    listStadiiPentruParcela(parcelaId, an),
    listAplicariParcela(parcelaId, { from, to }),
    listPlanuriTratament({ activ: true }),
    getGrupBiologicParcela(parcelaId),
    listProduseFitosanitare({ activ: true }),
    listInterventiiRelevanteParcela(parcelaId, an),
  ])

  if (!parcela) {
    notFound()
  }

  const configurareSezon = parcelaSezon ? await getOrCreateConfigurareSezon(parcelaSezon, an) : null
  const rubusMixt = isRubusMixt(configurareSezon)
  const planuriDisponibile = filterPlanuriDisponibile(toatePlanurile, parcela)
  const singleStageState = rubusMixt ? null : buildStageState(stadii, grupBiologic, null)
  const dualStageState = rubusMixt
    ? {
        floricane: buildStageState(stadii, grupBiologic, 'floricane'),
        primocane: buildStageState(stadii, grupBiologic, 'primocane'),
      }
    : null

  const aplicariSortate = sortAplicariAsc(aplicari)
  const urmatoareleAplicari = aplicariSortate.slice(0, 10)
  const aplicariCount = aplicariSortate.length
  const isGlobalEmpty = !planActiv && stadii.length === 0 && aplicariSortate.length === 0
  const canGenerate = Boolean(
    planActiv?.plan?.id &&
      (
        singleStageState?.stadiuCurent ||
        dualStageState?.floricane.stadiuCurent ||
        dualStageState?.primocane.stadiuCurent
      )
  )

  let generationPreview: { creatableCount: number; skippedCount: number } | null = null
  if (canGenerate) {
    try {
      const dryRun = await genereazaAplicariPentruParcela({
        parcelaId,
        an,
        dryRun: true,
      })
      generationPreview = {
        creatableCount: dryRun.propuneri.filter((item) => !item.motivSkip).length,
        skippedCount: dryRun.skippedCount,
      }
    } catch {
      generationPreview = {
        creatableCount: 0,
        skippedCount: 0,
      }
    }
  }

  return (
    <AppShell
      header={
        <ParcelaTratamenteHeader
          an={an}
          backHref={`/parcele/${parcelaId}`}
          parcelaName={parcela.nume_parcela ?? 'Parcelă'}
        />
      }
      bottomInset="calc(var(--app-nav-clearance) + 1rem)"
    >
      <ParcelaTratamenteDashboardClient
        an={an}
        aplicariCount={aplicariCount}
        createPlanHref={`/tratamente/planuri/nou?parcela_id=${parcelaId}`}
        importPlanHref="/tratamente/planuri/import"
        configurareSezon={configurareSezon}
        detailsHref={getPlanDetailsHref(planActiv)}
        editPlanHref={getPlanEditHref(planActiv)}
        generationPreview={generationPreview}
        grupBiologic={grupBiologic}
        isGlobalEmpty={isGlobalEmpty}
        parcela={parcela}
        parcelaId={parcelaId}
        planActiv={planActiv}
        planuriDisponibile={planuriDisponibile}
        produseFitosanitare={produseFitosanitare as ProdusFitosanitar[]}
        interventiiRelevante={interventiiRelevante as InterventieRelevantaV2[]}
        stadii={stadii}
        isRubusMixt={rubusMixt}
        singleStageState={singleStageState}
        dualStageState={dualStageState}
        urmatoareleAplicari={urmatoareleAplicari}
      />
    </AppShell>
  )
}
