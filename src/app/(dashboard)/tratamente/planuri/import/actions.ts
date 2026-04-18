'use server'

import { revalidatePath } from 'next/cache'

import {
  createProdusFitosanitar,
  mapTratamenteError,
  upsertPlanTratamentCuLinii,
} from '@/lib/supabase/queries/tratamente'
import type { PlanSaveInput } from '@/lib/tratamente/import/types'

export type {
  DraftProdusImport,
  FuzzySuggestion,
  ParseResult,
  ParsedLine,
  ParsedPlan,
  PlanSaveInput,
  PlanSaveLineInput,
  ProdusMatch,
} from '@/lib/tratamente/import/types'

export async function saveImportedPlansAction(
  planuri: PlanSaveInput[],
  an: number
): Promise<{ success: number; failed: Array<{ plan_nume: string; error: string }> }> {
  const failed: Array<{ plan_nume: string; error: string }> = []
  let success = 0
  const createdProduseCache = new Map<string, string>()

  for (const plan of planuri) {
    const planName = plan.plan_metadata.nume.trim() || 'Plan fără nume'

      try {
        if (!plan.linii.length) {
          throw new Error('Planul nu conține nicio linie validă pentru import.')
        }

        const resolvedLines = []
        for (const line of plan.linii) {
          let produsId = line.produs_id

          if (line.produs_de_creat) {
            const cacheKey = [
              line.produs_de_creat.nume_comercial.trim().toLowerCase(),
              line.produs_de_creat.substanta_activa.trim().toLowerCase(),
              line.produs_de_creat.tip,
            ].join('|')

            const cachedProdusId = createdProduseCache.get(cacheKey)
            if (cachedProdusId) {
              produsId = cachedProdusId
            } else {
              const createdProdus = await createProdusFitosanitar({
                ...line.produs_de_creat,
                activ: line.produs_de_creat.activ ?? true,
              })
              produsId = createdProdus.id
              createdProduseCache.set(cacheKey, createdProdus.id)
            }
          }

        resolvedLines.push({
          ordine: line.ordine,
          stadiu_trigger: line.stadiu_trigger,
          produs_id: produsId ?? null,
          produs_nume_manual: line.produs_nume_manual,
          doza_ml_per_hl: line.doza_ml_per_hl,
          doza_l_per_ha: line.doza_l_per_ha,
          observatii: line.observatii,
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
        [],
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
