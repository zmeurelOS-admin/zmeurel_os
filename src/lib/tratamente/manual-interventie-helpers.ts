import { z } from 'zod'

import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import {
  hasAplicareProductDraftErrors,
  parseAplicareProduse,
  parseDiferenteFataDePlan,
  type AplicareProdusPayload,
} from '@/lib/tratamente/aplicare-payload'

const manualInterventieSchema = z.object({
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  status: z.enum(['planificata', 'aplicata']),
  data: z.string().trim().min(1, 'Data intervenției este obligatorie.'),
  tip_interventie: z.string().trim().min(1, 'Tipul intervenției este obligatoriu.'),
  scop: z.string().trim().min(1, 'Scopul intervenției este obligatoriu.'),
  stadiu_la_aplicare: z.string().trim().optional(),
  cohort_la_aplicare: z.enum(['floricane', 'primocane']).optional().nullable(),
  operator: z.string().trim().optional(),
  observatii: z.string().optional(),
  cantitate_totala_ml: z.string().optional(),
  produse: z.string().min(1, 'Adaugă cel puțin un produs.'),
  diferente_fata_de_plan: z.string().optional(),
})

export interface ManualInterventiePayload {
  parcelaId: string
  status: 'planificata' | 'aplicata'
  data: string
  tip_interventie: string
  scop: string
  stadiu_la_aplicare: string | null
  cohort_la_aplicare: Cohorta | null
  operator: string | null
  observatii: string | null
  cantitate_totala_ml: number | null
  produse: AplicareProdusPayload[]
  diferenteFataDePlan: ReturnType<typeof parseDiferenteFataDePlan>
}

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function toOptionalNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function parseManualInterventieFormData(formData: FormData): ManualInterventiePayload {
  const parsed = manualInterventieSchema.safeParse({
    parcelaId: getFormValue(formData, 'parcelaId'),
    status: getFormValue(formData, 'status'),
    data: getFormValue(formData, 'data'),
    tip_interventie: getFormValue(formData, 'tip_interventie'),
    scop: getFormValue(formData, 'scop'),
    stadiu_la_aplicare: getFormValue(formData, 'stadiu_la_aplicare') || undefined,
    cohort_la_aplicare: (formData.get('cohort_la_aplicare') as Cohorta | string | null | undefined) ?? undefined,
    operator: getFormValue(formData, 'operator'),
    observatii: formData.get('observatii')?.toString() ?? '',
    cantitate_totala_ml: getFormValue(formData, 'cantitate_totala_ml'),
    produse: getFormValue(formData, 'produse'),
    diferente_fata_de_plan: getFormValue(formData, 'diferente_fata_de_plan'),
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Nu am putut salva intervenția manuală.')
  }

  const produse = parseAplicareProduse(parsed.data.produse)
  const productError = hasAplicareProductDraftErrors(produse)
  if (productError) {
    throw new Error(productError)
  }

  return {
    parcelaId: parsed.data.parcelaId,
    status: parsed.data.status,
    data: parsed.data.data,
    tip_interventie: parsed.data.tip_interventie,
    scop: parsed.data.scop,
    stadiu_la_aplicare: parsed.data.stadiu_la_aplicare?.trim() || null,
    cohort_la_aplicare: (parsed.data.cohort_la_aplicare === 'floricane' || parsed.data.cohort_la_aplicare === 'primocane'
      ? parsed.data.cohort_la_aplicare
      : null),
    operator: parsed.data.operator?.trim() || null,
    observatii: parsed.data.observatii?.trim() || null,
    cantitate_totala_ml: toOptionalNumber(parsed.data.cantitate_totala_ml ?? undefined),
    produse,
    diferenteFataDePlan: parseDiferenteFataDePlan(parsed.data.diferente_fata_de_plan) ?? null,
  }
}