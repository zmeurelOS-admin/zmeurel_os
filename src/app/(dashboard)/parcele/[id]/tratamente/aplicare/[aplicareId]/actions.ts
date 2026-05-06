'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  anuleazaAplicare,
  getAplicareById,
  mapTratamenteError,
  markAplicareAsAplicata,
  reprogrameazaAplicare,
  salveazaAplicareCiorna,
} from '@/lib/supabase/queries/tratamente'
import type { AplicareProdusInput } from '@/lib/supabase/queries/tratamente'
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
  produse: z.string().optional(),
  diferente_fata_de_plan: z.string().optional(),
})

const produsAplicareSchema = z.object({
  plan_linie_produs_id: z.string().uuid().optional().nullable(),
  ordine: z.number().int().positive().optional(),
  produs_id: z.string().uuid().optional().nullable(),
  produs_nume_manual: z.string().trim().max(120).optional().nullable(),
  produs_nume_snapshot: z.string().trim().max(120).optional().nullable(),
  substanta_activa_snapshot: z.string().trim().max(160).optional().nullable(),
  tip_snapshot: z.string().trim().max(40).optional().nullable(),
  frac_irac_snapshot: z.string().trim().max(40).optional().nullable(),
  phi_zile_snapshot: z.number().int().min(0).optional().nullable(),
  doza_ml_per_hl: z.number().min(0).optional().nullable(),
  doza_l_per_ha: z.number().min(0).optional().nullable(),
  cantitate_totala: z.number().min(0).optional().nullable(),
  unitate_cantitate: z.enum(['ml', 'l', 'kg', 'g', 'buc', 'altul']).optional().nullable(),
  stoc_mutatie_id: z.string().uuid().optional().nullable(),
  observatii: z.string().trim().max(500).optional().nullable(),
}).superRefine((value, ctx) => {
  const hasProdusId = typeof value.produs_id === 'string' && value.produs_id.trim().length > 0
  const hasManual = typeof value.produs_nume_manual === 'string' && value.produs_nume_manual.trim().length > 0

  if (!hasProdusId && !hasManual) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['produs_id'],
      message: 'Fiecare produs trebuie să fie selectat din bibliotecă sau completat manual.',
    })
  }
})

const ciornaProdusAplicareSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  plan_linie_produs_id: z.string().uuid().optional().nullable(),
  ordine: z.number().int().positive().optional(),
  produs_id: z.string().uuid().optional().nullable(),
  produs_nume_manual: z.string().trim().max(120).optional().nullable(),
  produs_nume_snapshot: z.string().trim().max(120).optional().nullable(),
  substanta_activa_snapshot: z.string().trim().max(160).optional().nullable(),
  tip_snapshot: z.string().trim().max(40).optional().nullable(),
  frac_irac_snapshot: z.string().trim().max(40).optional().nullable(),
  phi_zile_snapshot: z.number().int().min(0).optional().nullable(),
  doza_ml_per_hl: z.number().min(0).optional().nullable(),
  doza_l_per_ha: z.number().min(0).optional().nullable(),
  cantitate_totala: z.number().min(0).optional().nullable(),
  unitate_cantitate: z.enum(['ml', 'l', 'kg', 'g', 'buc', 'altul']).optional().nullable(),
  stoc_mutatie_id: z.string().uuid().optional().nullable(),
  observatii: z.string().trim().max(500).optional().nullable(),
}).superRefine((value, ctx) => {
  const hasProdusId = typeof value.produs_id === 'string' && value.produs_id.trim().length > 0
  const hasManual = typeof value.produs_nume_manual === 'string' && value.produs_nume_manual.trim().length > 0
  const hasSnapshot = typeof value.produs_nume_snapshot === 'string' && value.produs_nume_snapshot.trim().length > 0

  if (!hasProdusId && !hasManual && !hasSnapshot) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['produs_id'],
      message: 'Fiecare produs trebuie să fie selectat din bibliotecă sau completat manual.',
    })
  }
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

function parseJsonField(raw: string | undefined): unknown {
  if (!raw?.trim()) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function parseProduse(raw: string | undefined) {
  const parsedJson = parseJsonField(raw)
  if (parsedJson === undefined) return undefined

  const parsed = z.array(produsAplicareSchema).min(1).safeParse(parsedJson)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Produsele aplicării nu sunt valide.')
  }

  return parsed.data.map((produs, index) => ({
    ...produs,
    ordine: produs.ordine ?? index + 1,
  }))
}

function parseDiferente(raw: string | undefined): Json | null | undefined {
  const parsedJson = parseJsonField(raw)
  if (parsedJson === undefined) return undefined
  if (parsedJson === null) return null
  return parsedJson as Json
}

const salveazaCiornaSchema = z.object({
  operator: z.string().trim().max(120).optional().nullable(),
  observatii: z.string().trim().max(2000).optional().nullable(),
  produse: z.array(ciornaProdusAplicareSchema).min(1, 'Aplicarea trebuie să aibă cel puțin un produs.'),
  diferente_fata_de_plan: z.record(z.string(), z.unknown()).optional().nullable(),
})

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
    produse: getFormValue(formData, 'produse'),
    diferente_fata_de_plan: getFormValue(formData, 'diferente_fata_de_plan'),
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
      produse: parseProduse(parsed.data.produse),
      diferenteFataDePlan: parseDiferente(parsed.data.diferente_fata_de_plan),
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

export async function salveazaCiornaAction(
  aplicareId: string,
  payload: {
    operator?: string | null
    observatii?: string | null
    produse: AplicareProdusInput[]
    diferente_fata_de_plan?: Record<string, unknown> | null
  }
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(aplicareId).success) {
    return { ok: false, error: 'Aplicarea selectată nu este validă.' }
  }

  const parsed = salveazaCiornaSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Nu am putut salva ciorna.',
    }
  }

  try {
    const aplicare = await getAplicareById(aplicareId)
    if (!aplicare?.parcela_id) {
      return { ok: false, error: 'Aplicarea nu a fost găsită.' }
    }

    if (aplicare.status !== 'planificata' && aplicare.status !== 'ciorna') {
      return { ok: false, error: 'Aplicarea poate fi editată doar înainte de marcare ca aplicată.' }
    }

    await salveazaAplicareCiorna(aplicareId, {
      operator: parsed.data.operator,
      observatii: parsed.data.observatii,
      produse: parsed.data.produse,
      diferenteFataDePlan: (parsed.data.diferente_fata_de_plan ?? null) as Json | null,
    })

    revalidateAplicarePaths(aplicare.parcela_id, aplicareId)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut salva ciorna aplicării.').message,
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
