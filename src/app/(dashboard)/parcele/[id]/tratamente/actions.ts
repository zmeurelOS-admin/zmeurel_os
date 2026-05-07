'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Json } from '@/types/supabase'

import {
  assignPlanToParcela,
  createAplicareManuala,
  createAplicarePlanificataDinInterventie,
  mapTratamenteError,
  recordStadiu,
} from '@/lib/supabase/queries/tratamente'
import { upsertConfigurareSezon } from '@/lib/supabase/queries/configurari-sezon'
import { genereazaAplicariPentruParcela } from '@/lib/tratamente/generator/generator'
import { parseManualInterventieFormData } from '@/lib/tratamente/manual-interventie-action'
import type { Cohorta, SistemConducere, TipCicluSoi } from '@/lib/tratamente/configurare-sezon'

export type TratamenteActionResult =
  | { ok: true }
  | { ok: false; error: string }

export type ManualInterventieActionResult =
  | { ok: true }
  | { ok: false; error: string }

export type GenerateAplicariActionResult =
  | { ok: true; createdCount: number; skippedCount: number }
  | { ok: false; error: string }

export type PlanificaInterventieActionResult =
  | { ok: true; aplicareId: string }
  | { ok: false; error: string }

export type ConfigurareSezonActionResult =
  | { ok: true }
  | { ok: false; error: string }

const recordStadiuSchema = z.object({
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  an: z.coerce.number().int().min(2020).max(2100),
  stadiu: z.string().trim().min(1, 'Selectează un stadiu.'),
  cohort: z.enum(['floricane', 'primocane']).optional().nullable(),
  data_observata: z.string().trim().min(1, 'Data observării este obligatorie.'),
  sursa: z.enum(['manual', 'gdd', 'poza', 'auto'], {
    message: 'Selectează sursa stadiului.',
  }),
  observatii: z.string().optional(),
})

const assignPlanSchema = z.object({
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  planId: z.string().uuid('Planul selectat nu este valid.'),
  an: z.coerce.number().int().min(2020).max(2100),
})

const generateAplicariSchema = z.object({
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  an: z.number().int().min(2020).max(2100),
})

const planificaInterventieSchema = z.object({
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  planLinieId: z.string().uuid('Intervenția selectată nu este validă.'),
  dataPlanificata: z.string().trim().optional(),
  cohortLaAplicare: z.enum(['floricane', 'primocane']).optional().nullable(),
})

const upsertConfigurareSezonSchema = z.object({
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  an: z.coerce.number().int().min(2020).max(2100),
  sistem_conducere: z.enum(['primocane_only', 'mixt_floricane_primocane']).nullable().optional(),
  tip_ciclu_soi: z.enum(['determinat', 'nedeterminat']).nullable().optional(),
})

function revalidateTratamentePath(parcelaId: string) {
  revalidatePath(`/parcele/${parcelaId}/tratamente`)
  revalidatePath('/tratamente')
}

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

export async function recordStadiuAction(formData: FormData): Promise<TratamenteActionResult> {
  const parsed = recordStadiuSchema.safeParse({
    parcelaId: getFormValue(formData, 'parcelaId'),
    an: getFormValue(formData, 'an'),
    stadiu: getFormValue(formData, 'stadiu'),
    cohort: (formData.get('cohort') as Cohorta | string | null | undefined) ?? undefined,
    data_observata: getFormValue(formData, 'data_observata'),
    sursa: getFormValue(formData, 'sursa'),
    observatii: getFormValue(formData, 'observatii'),
  })

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Nu am putut salva stadiul.',
    }
  }

  try {
    const { parcelaId, an, stadiu, cohort, data_observata, sursa, observatii } = parsed.data
    await recordStadiu({
      parcela_id: parcelaId,
      an,
      stadiu,
      cohort: cohort ?? null,
      data_observata,
      sursa,
      observatii: observatii?.trim() || null,
    })
    revalidateTratamentePath(parcelaId)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut salva stadiul fenologic.').message,
    }
  }
}

export async function assignPlanAction(formData: FormData): Promise<TratamenteActionResult> {
  const parsed = assignPlanSchema.safeParse({
    parcelaId: getFormValue(formData, 'parcelaId'),
    planId: getFormValue(formData, 'planId'),
    an: getFormValue(formData, 'an'),
  })

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Nu am putut atribui planul.',
    }
  }

  try {
    const { parcelaId, planId, an } = parsed.data
    await assignPlanToParcela(parcelaId, planId, an)
    revalidateTratamentePath(parcelaId)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut atribui planul de tratament.').message,
    }
  }
}

export async function generateAplicariAction(
  parcelaId: string,
  an: number,
): Promise<GenerateAplicariActionResult> {
  const parsed = generateAplicariSchema.safeParse({ parcelaId, an })
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Nu am putut genera aplicările.',
    }
  }

  try {
    const result = await genereazaAplicariPentruParcela({
      parcelaId: parsed.data.parcelaId,
      an: parsed.data.an,
      dryRun: false,
    })

    revalidateTratamentePath(parsed.data.parcelaId)
    return {
      ok: true,
      createdCount: result.createdCount,
      skippedCount: result.skippedCount,
    }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut genera aplicările planificate.').message,
    }
  }
}

export async function planificaInterventieRelevantaAction(formData: FormData): Promise<PlanificaInterventieActionResult> {
  const parsed = planificaInterventieSchema.safeParse({
    parcelaId: getFormValue(formData, 'parcelaId'),
    planLinieId: getFormValue(formData, 'planLinieId'),
    dataPlanificata: getFormValue(formData, 'dataPlanificata'),
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

    revalidateTratamentePath(parsed.data.parcelaId)
    return { ok: true, aplicareId: aplicare.id }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut pregăti aplicarea din plan.').message,
    }
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

    revalidateTratamentePath(parsed.parcelaId)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut salva intervenția manuală.').message,
    }
  }
}

export async function upsertConfigurareSezonAction(formData: FormData): Promise<ConfigurareSezonActionResult> {
  const parsed = upsertConfigurareSezonSchema.safeParse({
    parcelaId: getFormValue(formData, 'parcelaId'),
    an: getFormValue(formData, 'an'),
    sistem_conducere: (formData.get('sistem_conducere') as SistemConducere | null | string | undefined) ?? undefined,
    tip_ciclu_soi: (formData.get('tip_ciclu_soi') as TipCicluSoi | null | string | undefined) ?? undefined,
  })

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Nu am putut salva configurarea sezonieră.',
    }
  }

  try {
    const { parcelaId, an, sistem_conducere, tip_ciclu_soi } = parsed.data
    await upsertConfigurareSezon({
      parcela_id: parcelaId,
      an,
      sistem_conducere: sistem_conducere ?? null,
      tip_ciclu_soi: tip_ciclu_soi ?? null,
    })
    revalidateTratamentePath(parcelaId)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut salva configurarea sezonieră.').message,
    }
  }
}
