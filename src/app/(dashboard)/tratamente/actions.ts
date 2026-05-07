'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { Json } from '@/types/supabase'

import { getMeteoZi, logMeteoWarning } from '@/lib/tratamente/meteo'
import type { MeteoZi } from '@/lib/tratamente/meteo'
import {
  createAplicareManuala,
  createAplicarePlanificataDinInterventie,
  mapTratamenteError,
} from '@/lib/supabase/queries/tratamente'
import { parseManualInterventieFormData } from '@/lib/tratamente/manual-interventie-action'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'

const parcelaIdSchema = z.string().uuid('Parcela selectată nu este validă.')
const planificaInterventieSchema = z.object({
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  planLinieId: z.string().uuid('Intervenția selectată nu este validă.'),
  dataPlanificata: z.string().trim().optional(),
  cohortLaAplicare: z.enum(['floricane', 'primocane']).optional().nullable(),
})

export type ManualInterventieActionResult =
  | { ok: true }
  | { ok: false; error: string }

export type PlanificaInterventieActionResult =
  | { ok: true; aplicareId: string }
  | { ok: false; error: string }

export async function loadHubMeteoParcelaAction(parcelaId: string): Promise<MeteoZi | null> {
  const parsed = parcelaIdSchema.safeParse(parcelaId)
  if (!parsed.success) {
    return null
  }

  try {
    return await getMeteoZi(parsed.data)
  } catch (error) {
    logMeteoWarning('Nu s-a putut încărca meteo pentru hub-ul global de tratamente.', error, {
      parcelaId: parsed.data,
    })
    return null
  }
}

export async function createManualInterventieAction(formData: FormData): Promise<ManualInterventieActionResult> {
  try {
    const parsed = parseManualInterventieFormData(formData)

    await createAplicareManuala({
      parcela_id: parsed.parcelaId,
      status: parsed.status,
      data_planificata: parsed.status === 'planificata' ? parsed.data.slice(0, 10) : null,
      data_aplicata: parsed.status === 'aplicata' ? new Date(parsed.data).toISOString() : null,
      tip_interventie: parsed.tip_interventie,
      scop: parsed.scop,
      stadiu_la_aplicare: parsed.stadiu_la_aplicare,
      cohort_la_aplicare: null,
      operator: parsed.operator,
      observatii: parsed.observatii,
      cantitate_totala_ml: parsed.cantitate_totala_ml,
      meteo_snapshot: (parsed.meteoSnapshot as Json | null) ?? null,
      produse: parsed.produse,
      diferente_fata_de_plan: parsed.diferenteFataDePlan,
    })

    revalidatePath('/tratamente')
    revalidatePath(`/parcele/${parsed.parcelaId}/tratamente`)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut salva intervenția manuală.').message,
    }
  }
}

export async function planificaInterventieRelevantaAction(formData: FormData): Promise<PlanificaInterventieActionResult> {
  const parsed = planificaInterventieSchema.safeParse({
    parcelaId: formData.get('parcelaId'),
    planLinieId: formData.get('planLinieId'),
    dataPlanificata: formData.get('dataPlanificata'),
    cohortLaAplicare: (formData.get('cohortLaAplicare') as Cohorta | string | null | undefined) ?? undefined,
  })

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Nu am putut pregăti aplicarea.',
    }
  }

  try {
    const aplicare = await createAplicarePlanificataDinInterventie({
      parcela_id: parsed.data.parcelaId,
      plan_linie_id: parsed.data.planLinieId,
      data_planificata: parsed.data.dataPlanificata?.trim() || null,
      cohort_la_aplicare: parsed.data.cohortLaAplicare ?? null,
    })

    revalidatePath('/tratamente')
    revalidatePath(`/parcele/${parsed.data.parcelaId}/tratamente`)
    return { ok: true, aplicareId: aplicare.id }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut pregăti aplicarea din plan.').message,
    }
  }
}
