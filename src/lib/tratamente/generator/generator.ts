import {
  createAplicarePlanificata,
  getPlanActivPentruParcela,
  getPlanTratamentCuLinii,
  listAplicariParcela,
  listStadiiPentruParcela,
} from '@/lib/supabase/queries/tratamente'

import { detectDuplicates } from './deduplication'
import { matchLiniiCuStadii } from './stadiu-matcher'
import type {
  AplicareExistenta,
  GeneratorInput,
  GeneratorResult,
  PlanLinie,
  PropunereAplicare,
  StadiuInregistrat,
} from './types'

function buildYearDateRange(an: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(an, 0, 1, 0, 0, 0, 0)),
    to: new Date(Date.UTC(an, 11, 31, 23, 59, 59, 999)),
  }
}

function toPlanLinie(linie: Awaited<ReturnType<typeof getPlanTratamentCuLinii>> extends infer T
  ? T extends { linii: Array<infer L> }
    ? L
    : never
  : never): PlanLinie {
  return {
    id: linie.id,
    planId: linie.plan_id,
    ordine: linie.ordine,
    stadiuTrigger: linie.stadiu_trigger,
    produsId: linie.produs_id,
    produsNumeManual: linie.produs_nume_manual,
    dozaMlPerHl: linie.doza_ml_per_hl,
    dozaLPerHa: linie.doza_l_per_ha,
    observatii: linie.observatii,
  }
}

function toStadiuInregistrat(
  stadiu: Awaited<ReturnType<typeof listStadiiPentruParcela>>[number]
): StadiuInregistrat {
  return {
    id: stadiu.id,
    parcelaId: stadiu.parcela_id,
    an: stadiu.an,
    stadiu: stadiu.stadiu,
    dataObservata: stadiu.data_observata,
    sursa: stadiu.sursa,
    observatii: stadiu.observatii,
  }
}

function toAplicareExistenta(
  aplicare: Awaited<ReturnType<typeof listAplicariParcela>>[number]
): AplicareExistenta {
  return {
    id: aplicare.id,
    planLinieId: aplicare.plan_linie_id,
    status: aplicare.status,
  }
}

function toPropunereAplicare(
  linie: PlanLinie & { dataPlanificata: string },
  motivSkip?: PropunereAplicare['motivSkip']
): PropunereAplicare {
  return {
    linieId: linie.id,
    stadiuTrigger: linie.stadiuTrigger,
    dataPlanificata: linie.dataPlanificata,
    produsId: linie.produsId,
    produsNumeManual: linie.produsNumeManual,
    dozaMlPerHl: linie.dozaMlPerHl,
    dozaLPerHa: linie.dozaLPerHa,
    observatii: linie.observatii,
    motivSkip,
  }
}

/**
 * Generează aplicări planificate pentru o parcelă pe baza planului activ și a stadiilor deja înregistrate.
 * Exemplu: `genereazaAplicariPentruParcela({ parcelaId: 'uuid', an: 2026, stadiuFiltru: 'inflorit', dryRun: true })`
 */
export async function genereazaAplicariPentruParcela(input: GeneratorInput): Promise<GeneratorResult> {
  const dryRun = input.dryRun ?? false
  const offsetZile = input.offsetZile ?? 0
  const planActiv = await getPlanActivPentruParcela(input.parcelaId, input.an)

  if (!planActiv?.plan?.id) {
    throw new Error(`Nu există plan activ pentru parcela ${input.parcelaId} în anul ${input.an}`)
  }

  const planComplet = await getPlanTratamentCuLinii(planActiv.plan.id)
  if (!planComplet) {
    throw new Error(`Planul activ ${planActiv.plan.id} nu a putut fi încărcat pentru parcela ${input.parcelaId}.`)
  }

  const { from, to } = buildYearDateRange(input.an)
  const [stadiiRaw, aplicariPlanificate, aplicariAplicate] = await Promise.all([
    listStadiiPentruParcela(input.parcelaId, input.an),
    listAplicariParcela(input.parcelaId, { status: 'planificata', from, to }),
    listAplicariParcela(input.parcelaId, { status: 'aplicata', from, to }),
  ])

  const linii = planComplet.linii.map(toPlanLinie)
  const stadii = stadiiRaw.map(toStadiuInregistrat)
  const aplicariExistente = [...aplicariPlanificate, ...aplicariAplicate].map(toAplicareExistenta)

  const potriviri = matchLiniiCuStadii(linii, stadii, input.stadiuFiltru, offsetZile)
  const { noi, duplicate } = detectDuplicates(potriviri, aplicariExistente)
  const duplicateIds = new Set(duplicate.map((linie) => linie.id))
  const propuneri = potriviri.map((linie) =>
    toPropunereAplicare(linie, duplicateIds.has(linie.id) ? 'deja_existenta' : undefined)
  )

  if (dryRun) {
    return {
      propuneri,
      createdCount: 0,
      skippedCount: duplicate.length,
      dryRun: true,
    }
  }

  let createdCount = 0
  for (const linie of noi) {
    await createAplicarePlanificata({
      parcela_id: input.parcelaId,
      plan_linie_id: linie.id,
      produs_id: linie.produsId,
      produs_nume_manual: linie.produsNumeManual,
      data_planificata: linie.dataPlanificata,
      doza_ml_per_hl: linie.dozaMlPerHl,
      doza_l_per_ha: linie.dozaLPerHa,
      observatii: linie.observatii,
      stadiu_la_aplicare: linie.stadiuTrigger,
      status: 'planificata',
    })
    createdCount += 1
  }

  return {
    propuneri,
    createdCount,
    skippedCount: duplicate.length,
    dryRun: false,
  }
}
