'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  anuleazaAplicare,
  getAplicareById,
  mapTratamenteError,
  markAplicareAsAplicata,
  reprogrameazaAplicare,
} from '@/lib/supabase/queries/tratamente'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import type { MeteoSnapshot } from '@/lib/tratamente/meteo'
import type { Json } from '@/types/supabase'

type ActionResult = { ok: true } | { ok: false; error: string }

const markSchema = z.object({
  aplicareId: z.string().uuid('Aplicarea selectată nu este validă.'),
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  data_aplicata: z.string().trim().min(1, 'Data aplicării este obligatorie.'),
  cantitate_totala_ml: z.string().optional(),
  operator: z.string().optional(),
  stadiu_la_aplicare: z.string().optional(),
  cohort_la_aplicare: z.enum(['floricane', 'primocane']).optional().nullable(),
  observatii: z.string().optional(),
  meteo_snapshot: z.string().optional(),
})

const reprogrameazaSchema = z.object({
  aplicareId: z.string().uuid('Aplicarea selectată nu este validă.'),
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  data_planificata: z.string().trim().min(1, 'Data nouă este obligatorie.'),
  motiv: z.string().optional(),
})

function revalidateAplicarePaths(parcelaId: string, aplicareId: string) {
  revalidatePath(`/parcele/${parcelaId}/tratamente`)
  revalidatePath(`/parcele/${parcelaId}/tratamente/aplicare/${aplicareId}`)
}

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseMeteoSnapshot(raw: string | undefined): Json | null | undefined {
  if (!raw?.trim()) return undefined

  try {
    const parsed = JSON.parse(raw) as MeteoSnapshot
    return parsed as unknown as Json
  } catch {
    return null
  }
}

export async function markAplicataAction(formData: FormData): Promise<ActionResult> {
  const parsed = markSchema.safeParse({
    aplicareId: getFormValue(formData, 'aplicareId'),
    parcelaId: getFormValue(formData, 'parcelaId'),
    data_aplicata: getFormValue(formData, 'data_aplicata'),
    cantitate_totala_ml: getFormValue(formData, 'cantitate_totala_ml'),
    operator: getFormValue(formData, 'operator'),
    stadiu_la_aplicare: getFormValue(formData, 'stadiu_la_aplicare'),
    cohort_la_aplicare: (formData.get('cohort_la_aplicare') as Cohorta | string | null | undefined) ?? undefined,
    observatii: getFormValue(formData, 'observatii'),
    meteo_snapshot: getFormValue(formData, 'meteo_snapshot'),
  })

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Nu am putut marca aplicarea.',
    }
  }

  try {
    await markAplicareAsAplicata(parsed.data.aplicareId, {
      dataAplicata: new Date(parsed.data.data_aplicata),
      cantitateTotala: parseOptionalNumber(parsed.data.cantitate_totala_ml),
      meteoSnapshot: parseMeteoSnapshot(parsed.data.meteo_snapshot),
      operator: parsed.data.operator,
      observatii: parsed.data.observatii,
      stadiuLaAplicare: parsed.data.stadiu_la_aplicare,
      cohortLaAplicare: parsed.data.cohort_la_aplicare ?? undefined,
    })

    revalidateAplicarePaths(parsed.data.parcelaId, parsed.data.aplicareId)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut marca aplicarea ca efectuată.').message,
    }
  }
}

export async function reprogrameazaAction(formData: FormData): Promise<ActionResult> {
  const parsed = reprogrameazaSchema.safeParse({
    aplicareId: getFormValue(formData, 'aplicareId'),
    parcelaId: getFormValue(formData, 'parcelaId'),
    data_planificata: getFormValue(formData, 'data_planificata'),
    motiv: getFormValue(formData, 'motiv'),
  })

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Nu am putut reprograma aplicarea.',
    }
  }

  try {
    await reprogrameazaAplicare(
      parsed.data.aplicareId,
      new Date(`${parsed.data.data_planificata}T00:00:00.000Z`),
      parsed.data.motiv,
    )

    revalidateAplicarePaths(parsed.data.parcelaId, parsed.data.aplicareId)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut reprograma aplicarea.').message,
    }
  }
}

export async function anuleazaAction(aplicareId: string, motiv: string): Promise<ActionResult> {
  if (!aplicareId) {
    return { ok: false, error: 'Aplicarea selectată nu este validă.' }
  }

  try {
    const aplicare = await getAplicareById(aplicareId)
    if (!aplicare?.parcela_id) {
      return { ok: false, error: 'Aplicarea nu a fost găsită.' }
    }

    await anuleazaAplicare(aplicareId, motiv || 'Anulare manuală')
    revalidateAplicarePaths(aplicare.parcela_id, aplicareId)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut anula aplicarea.').message,
    }
  }
}
