'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { Json } from '@/types/supabase'

import { getMeteoZi, logMeteoWarning } from '@/lib/tratamente/meteo'
import type { MeteoZi } from '@/lib/tratamente/meteo'
import {
  createAplicareManuala,
  createAplicarePlanificataDinInterventie,
  getAplicareById,
  mapTratamenteError,
} from '@/lib/supabase/queries/tratamente'
import type { MetodaAplicare } from '@/types/tratamente-metode'
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

export type AplicareEditData = {
  id: string
  parcelaId: string
  parcelaNume: string | null
  metodaAplicare: MetodaAplicare | null
  dataAplicata: string
  produse: Array<{
    produsId: string | null
    produsNume: string
    cantitateText: string
    dozaMlHl?: number | null
    dozaLHa?: number | null
  }>
  observatii: string | null
  operator: string | null
  stadiuLaAplicare: string | null
}

export type FetchAplicareEditActionResult =
  | { ok: true; data: AplicareEditData }
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
      metoda_aplicare: parsed.metoda_aplicare,
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

export async function fetchAplicareEditAction(aplicareId: string): Promise<FetchAplicareEditActionResult> {
  const parsed = z.string().uuid('Aplicarea selectată nu este validă.').safeParse(aplicareId)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Aplicarea selectată nu este validă.' }
  }

  try {
    const aplicare = await getAplicareById(parsed.data)
    if (!aplicare) {
      return { ok: false, error: 'Aplicarea nu a fost găsită.' }
    }

    const produseAplicare = aplicare.produse_aplicare ?? []
    const produse = produseAplicare.length > 0
      ? produseAplicare.map((produs) => ({
          produsId: produs.produs_id,
          produsNume:
            produs.produs?.nume_comercial ??
            produs.produs_nume_snapshot ??
            produs.produs_nume_manual ??
            'Produs nespecificat',
          cantitateText: produs.cantitate_text ?? '',
          dozaMlHl: produs.doza_ml_per_hl,
          dozaLHa: produs.doza_l_per_ha,
        }))
      : [{
          produsId: aplicare.produs_id,
          produsNume: aplicare.produs?.nume_comercial ?? aplicare.produs_nume_manual ?? 'Produs nespecificat',
          cantitateText: '',
          dozaMlHl: aplicare.doza_ml_per_hl,
          dozaLHa: aplicare.doza_l_per_ha,
        }]

    return {
      ok: true,
      data: {
        id: aplicare.id,
        parcelaId: aplicare.parcela_id,
        parcelaNume: aplicare.parcela?.nume_parcela ?? aplicare.parcela?.id_parcela ?? null,
        metodaAplicare: aplicare.metoda_aplicare as MetodaAplicare | null,
        dataAplicata: aplicare.data_aplicata ?? aplicare.data_planificata ?? aplicare.created_at,
        produse,
        observatii: aplicare.observatii,
        operator: aplicare.operator,
        stadiuLaAplicare: aplicare.stadiu_la_aplicare,
      },
    }
  } catch (error) {
    return {
      ok: false,
      error: mapTratamenteError(error, 'Nu am putut încărca aplicarea.').message,
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
