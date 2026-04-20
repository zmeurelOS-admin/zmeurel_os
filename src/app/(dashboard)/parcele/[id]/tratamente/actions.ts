'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assignPlanToParcela, mapTratamenteError, recordStadiu } from '@/lib/supabase/queries/tratamente'
import { upsertConfigurareSezon } from '@/lib/supabase/queries/configurari-sezon'
import { genereazaAplicariPentruParcela } from '@/lib/tratamente/generator/generator'
import type { Cohorta, SistemConducere, TipCicluSoi } from '@/lib/tratamente/configurare-sezon'

export type TratamenteActionResult =
  | { ok: true }
  | { ok: false; error: string }

export type GenerateAplicariActionResult =
  | { ok: true; createdCount: number; skippedCount: number }
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

const upsertConfigurareSezonSchema = z.object({
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  an: z.coerce.number().int().min(2020).max(2100),
  sistem_conducere: z.enum(['primocane_only', 'mixt_floricane_primocane']).nullable().optional(),
  tip_ciclu_soi: z.enum(['determinat', 'nedeterminat']).nullable().optional(),
})

function revalidateTratamentePath(parcelaId: string) {
  revalidatePath(`/parcele/${parcelaId}/tratamente`)
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
