'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assignPlanToParcela, mapTratamenteError, recordStadiu } from '@/lib/supabase/queries/tratamente'
import { genereazaAplicariPentruParcela } from '@/lib/tratamente/generator/generator'

export type TratamenteActionResult =
  | { ok: true }
  | { ok: false; error: string }

export type GenerateAplicariActionResult =
  | { ok: true; createdCount: number; skippedCount: number }
  | { ok: false; error: string }

const recordStadiuSchema = z.object({
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  an: z.coerce.number().int().min(2020).max(2100),
  stadiu: z.string().trim().min(1, 'Selectează un stadiu.'),
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
    const { parcelaId, an, stadiu, data_observata, sursa, observatii } = parsed.data
    await recordStadiu({
      parcela_id: parcelaId,
      an,
      stadiu,
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
