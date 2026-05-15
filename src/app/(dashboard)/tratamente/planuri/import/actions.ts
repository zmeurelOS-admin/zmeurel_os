'use server'

import { revalidatePath } from 'next/cache'

import {
  createProdusFitosanitar,
  getPlanActivPentruParcela,
  mapTratamenteError,
  upsertPlanTratamentCuLinii,
} from '@/lib/supabase/queries/tratamente'
import type { PlanSaveInput } from '@/lib/tratamente/import/types'

function normalizeImportKey(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function validateImportLineProducts(line: PlanSaveInput['linii'][number]) {
  if (line.produse.length === 0) {
    throw new Error(`Intervenția ${line.ordine} nu are produse de importat.`)
  }

  for (const produs of line.produse) {
    const hasCatalogProduct = Boolean(produs.produs_id)
    const hasManualProduct = Boolean(produs.produs_nume_manual?.trim() || produs.produs_nume_snapshot?.trim())
    const hasProductToCreate = Boolean(produs.produs_de_creat?.nume_comercial?.trim())

    if (!hasCatalogProduct && !hasManualProduct && !hasProductToCreate) {
      throw new Error(`Produsul ${produs.ordine} din intervenția ${line.ordine} nu are nume sau produs din bibliotecă.`)
    }
  }
}

export type {
  DraftProdusImport,
  FuzzySuggestion,
  ParseResult,
  ParsedLine,
  ParsedInterventieProdus,
  ParsedPlan,
  PlanSaveInput,
  PlanSaveLineInput,
  PlanSaveLineProductInput,
  ProdusMatch,
} from '@/lib/tratamente/import/types'

export async function saveImportedPlansAction(
  planuri: PlanSaveInput[],
  an: number,
  parcelaId?: string | null
): Promise<{ success: number; failed: Array<{ plan_nume: string; error: string }> }> {
  const failed: Array<{ plan_nume: string; error: string }> = []
  let success = 0
  const createdProduseCache = new Map<string, string>()
  const parceleIds =
    typeof parcelaId === 'string' && parcelaId.trim().length > 0 ? [parcelaId] : []

  for (const plan of planuri) {
    const planName = plan.plan_metadata.nume.trim() || 'Plan fără nume'

      try {
        if (!plan.linii.length) {
          throw new Error('Planul nu conține nicio linie validă pentru import.')
        }

        const resolvedLines = []
        for (const line of plan.linii) {
          validateImportLineProducts(line)
          const produse = []
          for (const produs of line.produse) {
            let produsId = produs.produs_id

            if (produs.produs_de_creat) {
              const cacheKey = [
                normalizeImportKey(produs.produs_de_creat.nume_comercial),
                normalizeImportKey(produs.produs_de_creat.substanta_activa),
                produs.produs_de_creat.tip,
              ].join('|')

              const cachedProdusId = createdProduseCache.get(cacheKey)
              if (cachedProdusId) {
                produsId = cachedProdusId
              } else {
                const createdProdus = await createProdusFitosanitar({
                  ...produs.produs_de_creat,
                  activ: produs.produs_de_creat.activ ?? true,
                })
                produsId = createdProdus.id
                createdProduseCache.set(cacheKey, createdProdus.id)
              }
            }

            produse.push({
              ordine: produs.ordine,
              produs_id: produsId ?? null,
              produs_nume_manual: produs.produs_nume_manual,
              produs_nume_snapshot: produs.produs_nume_snapshot,
              substanta_activa_snapshot: produs.substanta_activa_snapshot,
              tip_snapshot: produs.tip_snapshot,
              frac_irac_snapshot: produs.frac_irac_snapshot,
              phi_zile_snapshot: produs.phi_zile_snapshot,
              doza_ml_per_hl: produs.doza_ml_per_hl,
              doza_l_per_ha: produs.doza_l_per_ha,
              observatii: produs.observatii,
            })
          }

        resolvedLines.push({
          ordine: line.ordine,
          stadiu_trigger: line.stadiu_trigger,
          cohort_trigger: line.cohort_trigger,
          tip_interventie: line.tip_interventie,
          scop: line.scop,
          regula_repetare: line.regula_repetare,
          interval_repetare_zile: line.interval_repetare_zile,
          numar_repetari_max: line.numar_repetari_max,
          observatii: line.observatii,
          produse,
        })
      }

      await upsertPlanTratamentCuLinii(
        {
          nume: plan.plan_metadata.nume,
          cultura_tip: plan.plan_metadata.cultura_tip,
          descriere: plan.plan_metadata.descriere,
          activ: true,
          arhivat: false,
        },
        resolvedLines,
        parceleIds,
        an
      )

      success += 1
    } catch (error) {
      failed.push({
        plan_nume: planName,
        error: mapTratamenteError(error, 'Nu am putut salva planul importat.').message,
      })
    }
  }

  revalidatePath('/tratamente/planuri')
  revalidatePath('/tratamente/planuri/import')

  return { success, failed }
}

export async function checkConflictPlanAction(
  parcelaId: string,
  an: number
): Promise<{ conflict: boolean; numePlan?: string }> {
  const planActiv = await getPlanActivPentruParcela(parcelaId, an)

  if (!planActiv?.plan || !planActiv.plan.activ || planActiv.plan.arhivat) {
    return { conflict: false }
  }

  return {
    conflict: true,
    numePlan: planActiv.plan.nume ?? undefined,
  }
}
