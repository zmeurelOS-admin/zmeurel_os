import { endOfYear, startOfYear } from 'date-fns'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { ParcelaTratamenteHeader } from '@/components/tratamente/ParcelaTratamenteHeader'
import { ParcelaTratamenteDashboardClient } from '@/components/tratamente/ParcelaTratamenteDashboardClient'
import {
  getParcelaTratamenteContext,
  getPlanActivPentruParcela,
  listAplicariParcela,
  listPlanuriTratament,
  listStadiiPentruParcela,
  type AplicareTratamentDetaliu,
  type ParcelaTratamenteContext,
  type PlanActivParcela,
  type PlanTratament,
  type StadiuFenologicParcela,
} from '@/lib/supabase/queries/tratamente'
import { genereazaAplicariPentruParcela } from '@/lib/tratamente/generator/generator'
import { STADII_ORDINE, getStadiulUrmator } from '@/lib/tratamente/stadiu-ordering'

type PageProps = {
  params: Promise<{ id: string }>
}

const CURRENT_YEAR = 2026
const STADII_SORTATE = Object.entries(STADII_ORDINE).sort((a, b) => a[1].ordine - b[1].ordine)

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function getParcelaCultureHint(parcela: ParcelaTratamenteContext): string | null {
  const values = [parcela.cultura, parcela.tip_fruct]
    .map((value) => normalizeText(value))
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

function getStadiuCurent(stadii: StadiuFenologicParcela[]): StadiuFenologicParcela | null {
  if (stadii.length === 0) return null

  return [...stadii].sort((a, b) => {
    const ordineDiff =
      (STADII_ORDINE[b.stadiu]?.ordine ?? Number.MIN_SAFE_INTEGER) -
      (STADII_ORDINE[a.stadiu]?.ordine ?? Number.MIN_SAFE_INTEGER)
    if (ordineDiff !== 0) return ordineDiff

    const observedDiff = new Date(b.data_observata).getTime() - new Date(a.data_observata).getTime()
    if (observedDiff !== 0) return observedDiff

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })[0] ?? null
}

function getStadiuProgress(stadiu: string | null): number {
  if (!stadiu) return 0

  const index = STADII_SORTATE.findIndex(([key]) => key === stadiu)
  if (index === -1) return 0
  if (STADII_SORTATE.length === 1) return 100
  return Math.round((index / (STADII_SORTATE.length - 1)) * 100)
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
  const an = CURRENT_YEAR
  const from = startOfYear(new Date(Date.UTC(an, 0, 1)))
  const to = endOfYear(new Date(Date.UTC(an, 0, 1)))

  const [parcela, planActiv, stadii, aplicari, toatePlanurile] = await Promise.all([
    getParcelaTratamenteContext(parcelaId),
    getPlanActivPentruParcela(parcelaId, an),
    listStadiiPentruParcela(parcelaId, an),
    listAplicariParcela(parcelaId, { from, to }),
    listPlanuriTratament({ activ: true }),
  ])

  if (!parcela) {
    notFound()
  }

  const planuriDisponibile = filterPlanuriDisponibile(toatePlanurile, parcela)
  const stadiuCurent = getStadiuCurent(stadii)
  const stadiuUrmator = stadiuCurent ? getStadiulUrmator(stadiuCurent.stadiu) : null
  const stadiuProgress = getStadiuProgress(stadiuCurent?.stadiu ?? null)

  const aplicariSortate = sortAplicariAsc(aplicari)
  const urmatoareleAplicari = aplicariSortate.slice(0, 10)
  const aplicariCount = aplicariSortate.length
  const isGlobalEmpty = !planActiv && stadii.length === 0 && aplicariSortate.length === 0
  const canGenerate = Boolean(planActiv?.plan?.id && stadiuCurent)

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
        detailsHref={getPlanDetailsHref(planActiv)}
        editPlanHref={getPlanEditHref(planActiv)}
        generationPreview={generationPreview}
        isGlobalEmpty={isGlobalEmpty}
        parcela={parcela}
        parcelaId={parcelaId}
        planActiv={planActiv}
        planuriDisponibile={planuriDisponibile}
        stadii={stadii}
        stadiuCurent={stadiuCurent}
        stadiuProgress={stadiuProgress}
        stadiuUrmator={stadiuUrmator}
        urmatoareleAplicari={urmatoareleAplicari}
      />
    </AppShell>
  )
}
