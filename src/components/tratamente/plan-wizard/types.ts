import * as z from 'zod'

import { normalizeStadiu } from '@/lib/tratamente/stadii-canonic'
import { getCurrentSezon } from '@/lib/utils/sezon'
import type {
  InterventieProdusPayload,
  PlanTratamentComplet,
  PlanTratamentLiniePayload,
  PlanWizardParcelaOption,
  ProdusFitosanitar,
} from '@/lib/supabase/queries/tratamente'

export const planInfoSchema = z.object({
  nume: z.string().trim().min(1, 'Denumirea planului este obligatorie.').max(120, 'Denumirea poate avea cel mult 120 de caractere.'),
  cultura_tip: z.string().trim().min(1, 'Alege cultura țintă.'),
  descriere: z.string().trim().max(500, 'Descrierea poate avea cel mult 500 de caractere.').optional().or(z.literal('')),
})

export const linieDozaUnitSchema = z.enum(['ml/hl', 'l/ha'])

export const linieProdusDraftSchema = z
  .object({
    id: z.string().min(1),
    ordine: z.number().int().positive(),
    produs_id: z.string().trim().optional().nullable(),
    produs_nume_manual: z.string().trim().max(120, 'Numele manual poate avea cel mult 120 de caractere.').optional().nullable(),
    produs_nume_snapshot: z.string().trim().max(120).optional().nullable(),
    substanta_activa_snapshot: z.string().trim().max(160).optional().nullable(),
    tip_snapshot: z.string().trim().max(40).optional().nullable(),
    frac_irac_snapshot: z.string().trim().max(40).optional().nullable(),
    phi_zile_snapshot: z.number().int().min(0, 'PHI trebuie să fie pozitiv.').optional().nullable(),
    doza_ml_per_hl: z.number().min(0, 'Doza trebuie să fie pozitivă.').optional().nullable(),
    doza_l_per_ha: z.number().min(0, 'Doza trebuie să fie pozitivă.').optional().nullable(),
    observatii: z.string().trim().max(500, 'Observațiile pot avea cel mult 500 de caractere.').optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const hasProdusId = typeof value.produs_id === 'string' && value.produs_id.trim().length > 0
    const hasManualName = typeof value.produs_nume_manual === 'string' && value.produs_nume_manual.trim().length > 0

    if (!hasProdusId && !hasManualName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['produs_id'],
        message: 'Alege un produs sau completează numele manual.',
      })
    }
  })

export const linieDraftSchema = z
  .object({
    id: z.string().min(1),
    ordine: z.number().int().positive(),
    stadiu_trigger: z.string().trim().min(1, 'Alege stadiul fenologic.'),
    cohort_trigger: z.enum(['floricane', 'primocane']).nullable().optional(),
    tip_interventie: z.enum(['protectie', 'nutritie', 'biostimulare', 'erbicidare', 'igiena', 'monitorizare', 'altul']).nullable().optional(),
    scop: z.string().trim().max(240, 'Scopul poate avea cel mult 240 de caractere.').optional().nullable(),
    regula_repetare: z.enum(['fara_repetare', 'interval']).default('fara_repetare'),
    interval_repetare_zile: z.number().int().min(1, 'Intervalul trebuie să fie cel puțin 1 zi.').optional().nullable(),
    numar_repetari_max: z.number().int().min(1, 'Numărul de repetări trebuie să fie cel puțin 1.').optional().nullable(),
    produs_id: z.string().trim().optional().nullable(),
    produs_nume_manual: z.string().trim().max(120, 'Numele manual poate avea cel mult 120 de caractere.').optional().nullable(),
    dozaUnitate: linieDozaUnitSchema,
    doza: z.number({ error: 'Introduceți doza.' }).min(0, 'Doza trebuie să fie pozitivă.'),
    observatii: z.string().trim().max(500, 'Observațiile pot avea cel mult 500 de caractere.').optional().or(z.literal('')),
    produse: z.array(linieProdusDraftSchema).min(1, 'Adaugă cel puțin un produs.'),
  })
  .superRefine((value, ctx) => {
    if (
      value.regula_repetare === 'interval' &&
      typeof value.interval_repetare_zile !== 'number' &&
      typeof value.numar_repetari_max !== 'number'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['regula_repetare'],
        message: 'Completează intervalul sau numărul maxim de repetări.',
      })
    }
  })

export const asociereSchema = z.object({
  an: z.number().int().min(2020, 'Anul trebuie să fie valid.').max(2100, 'Anul trebuie să fie valid.'),
  parcele_ids: z.array(z.string()).default([]),
})

export type PlanWizardInfoData = z.infer<typeof planInfoSchema>
export type LinieDozaUnitate = z.infer<typeof linieDozaUnitSchema>
export type PlanWizardLinieProdusDraft = z.infer<typeof linieProdusDraftSchema>
export type PlanWizardLinieDraft = z.infer<typeof linieDraftSchema>
export type PlanWizardRevizuireData = z.infer<typeof asociereSchema>

export interface PlanWizardWarning {
  id: string
  tip: 'frac' | 'cupru'
  titlu: string
  descriere: string
}

export interface PlanWizardValues {
  info: PlanWizardInfoData
  linii: PlanWizardLinieDraft[]
  revizuire: PlanWizardRevizuireData
}

export interface PlanWizardReviewContext {
  produse: ProdusFitosanitar[]
  parcele: PlanWizardParcelaOption[]
}

function normalizeCohorta(value: string | null | undefined): 'floricane' | 'primocane' | null {
  return value === 'floricane' || value === 'primocane' ? value : null
}

function normalizeTipInterventie(value: string | null | undefined): PlanWizardLinieDraft['tip_interventie'] {
  return value === 'protectie' ||
    value === 'nutritie' ||
    value === 'biostimulare' ||
    value === 'erbicidare' ||
    value === 'igiena' ||
    value === 'monitorizare' ||
    value === 'altul'
    ? value
    : 'protectie'
}

function normalizeRegulaRepetare(value: string | null | undefined): PlanWizardLinieDraft['regula_repetare'] {
  return value === 'interval' ? 'interval' : 'fara_repetare'
}

export function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export function createEmptyLineProduct(nextOrdine: number): PlanWizardLinieProdusDraft {
  return {
    id: crypto.randomUUID(),
    ordine: nextOrdine,
    produs_id: null,
    produs_nume_manual: '',
    produs_nume_snapshot: null,
    substanta_activa_snapshot: '',
    tip_snapshot: '',
    frac_irac_snapshot: '',
    phi_zile_snapshot: null,
    doza_ml_per_hl: null,
    doza_l_per_ha: null,
    observatii: '',
  }
}

export function createEmptyLine(nextOrdine: number): PlanWizardLinieDraft {
  const produs = createEmptyLineProduct(1)
  return {
    id: crypto.randomUUID(),
    ordine: nextOrdine,
    stadiu_trigger: '',
    cohort_trigger: null,
    tip_interventie: 'protectie',
    scop: '',
    regula_repetare: 'fara_repetare',
    interval_repetare_zile: null,
    numar_repetari_max: null,
    produs_id: null,
    produs_nume_manual: '',
    dozaUnitate: 'ml/hl',
    doza: 0,
    observatii: '',
    produse: [produs],
  }
}

export function ensureConsecutiveOrdine(linii: PlanWizardLinieDraft[]): PlanWizardLinieDraft[] {
  return [...linii].map((linie, index) => ({
    ...linie,
    ordine: index + 1,
    produse: linie.produse.map((produs, produsIndex) => ({
      ...produs,
      ordine: produsIndex + 1,
    })),
  }))
}

function normalizeNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function produsToPayload(produs: PlanWizardLinieProdusDraft): InterventieProdusPayload {
  return {
    ordine: produs.ordine,
    produs_id: produs.produs_id?.trim() ? produs.produs_id : null,
    produs_nume_manual: produs.produs_nume_manual?.trim() ? produs.produs_nume_manual.trim() : null,
    produs_nume_snapshot: produs.produs_nume_snapshot?.trim() ? produs.produs_nume_snapshot.trim() : null,
    substanta_activa_snapshot: produs.substanta_activa_snapshot?.trim() ? produs.substanta_activa_snapshot.trim() : null,
    tip_snapshot: produs.tip_snapshot?.trim() ? produs.tip_snapshot.trim() as ProdusFitosanitar['tip'] : null,
    frac_irac_snapshot: produs.frac_irac_snapshot?.trim() ? produs.frac_irac_snapshot.trim() : null,
    phi_zile_snapshot: normalizeNumber(produs.phi_zile_snapshot),
    doza_ml_per_hl: normalizeNumber(produs.doza_ml_per_hl),
    doza_l_per_ha: normalizeNumber(produs.doza_l_per_ha),
    observatii: produs.observatii?.trim() ? produs.observatii.trim() : null,
  }
}

export function lineToPayload(linie: PlanWizardLinieDraft): PlanTratamentLiniePayload {
  const produse = linie.produse.map(produsToPayload)
  const firstProdus = produse[0] ?? null

  return {
    ordine: linie.ordine,
    stadiu_trigger: normalizeStadiu(linie.stadiu_trigger) ?? linie.stadiu_trigger,
    cohort_trigger: linie.cohort_trigger ?? null,
    tip_interventie: linie.tip_interventie ?? null,
    scop: linie.scop?.trim() ? linie.scop.trim() : null,
    regula_repetare: linie.regula_repetare,
    interval_repetare_zile: linie.regula_repetare === 'interval' ? normalizeNumber(linie.interval_repetare_zile) : null,
    numar_repetari_max: linie.regula_repetare === 'interval' ? normalizeNumber(linie.numar_repetari_max) : null,
    produs_id: firstProdus?.produs_id ?? null,
    produs_nume_manual: firstProdus?.produs_nume_manual ?? null,
    doza_ml_per_hl: firstProdus?.doza_ml_per_hl ?? null,
    doza_l_per_ha: firstProdus?.doza_l_per_ha ?? null,
    observatii: linie.observatii?.trim() ? linie.observatii.trim() : null,
    produse,
  }
}

function productDraftFromLegacyLine(
  linie: PlanTratamentComplet['linii'][number],
  fallbackId: string
): PlanWizardLinieProdusDraft {
  const firstProdus = linie.produse?.[0]

  return {
    id: firstProdus?.id ?? `${fallbackId}-produs-1`,
    ordine: firstProdus?.ordine ?? 1,
    produs_id: firstProdus?.produs_id ?? linie.produs_id ?? null,
    produs_nume_manual: firstProdus?.produs_nume_manual ?? linie.produs_nume_manual ?? '',
    produs_nume_snapshot: firstProdus?.produs_nume_snapshot ?? linie.produs?.nume_comercial ?? null,
    substanta_activa_snapshot: firstProdus?.substanta_activa_snapshot ?? linie.produs?.substanta_activa ?? '',
    tip_snapshot: firstProdus?.tip_snapshot ?? linie.produs?.tip ?? '',
    frac_irac_snapshot: firstProdus?.frac_irac_snapshot ?? linie.produs?.frac_irac ?? '',
    phi_zile_snapshot: firstProdus?.phi_zile_snapshot ?? linie.produs?.phi_zile ?? null,
    doza_ml_per_hl: firstProdus?.doza_ml_per_hl ?? linie.doza_ml_per_hl ?? null,
    doza_l_per_ha: firstProdus?.doza_l_per_ha ?? linie.doza_l_per_ha ?? null,
    observatii: firstProdus?.observatii ?? '',
  }
}

function productsFromLine(linie: PlanTratamentComplet['linii'][number], fallbackId: string): PlanWizardLinieProdusDraft[] {
  const produse = linie.produse?.length
    ? linie.produse.map((produs, index) => ({
        id: produs.id || `${fallbackId}-produs-${index + 1}`,
        ordine: produs.ordine ?? index + 1,
        produs_id: produs.produs_id ?? null,
        produs_nume_manual: produs.produs_nume_manual ?? '',
        produs_nume_snapshot: produs.produs_nume_snapshot ?? produs.produs?.nume_comercial ?? null,
        substanta_activa_snapshot: produs.substanta_activa_snapshot ?? produs.produs?.substanta_activa ?? '',
        tip_snapshot: produs.tip_snapshot ?? produs.produs?.tip ?? '',
        frac_irac_snapshot: produs.frac_irac_snapshot ?? produs.produs?.frac_irac ?? '',
        phi_zile_snapshot: produs.phi_zile_snapshot ?? produs.produs?.phi_zile ?? null,
        doza_ml_per_hl: produs.doza_ml_per_hl ?? null,
        doza_l_per_ha: produs.doza_l_per_ha ?? null,
        observatii: produs.observatii ?? '',
      }))
    : [productDraftFromLegacyLine(linie, fallbackId)]

  return produse.map((produs, index) => ({ ...produs, ordine: index + 1 }))
}

export function planToWizardValues(plan: PlanTratamentComplet): PlanWizardValues {
  const anImplicit = plan.parcele_asociate[0]?.an ?? getCurrentSezon()

  return {
    info: {
      nume: plan.nume,
      cultura_tip: plan.cultura_tip,
      descriere: plan.descriere ?? '',
    },
    linii: ensureConsecutiveOrdine(
      plan.linii.map((linie, index) => {
        const fallbackId = linie.id || `linie-${index + 1}`
        const produse = productsFromLine(linie, fallbackId)
        const firstProdus = produse[0]

        return {
          id: fallbackId,
          ordine: linie.ordine ?? index + 1,
          stadiu_trigger: normalizeStadiu(linie.stadiu_trigger) ?? linie.stadiu_trigger,
          cohort_trigger: normalizeCohorta(linie.cohort_trigger),
          tip_interventie: normalizeTipInterventie(linie.tip_interventie),
          scop: linie.scop ?? '',
          regula_repetare: normalizeRegulaRepetare(linie.regula_repetare),
          interval_repetare_zile: linie.interval_repetare_zile ?? null,
          numar_repetari_max: linie.numar_repetari_max ?? null,
          produs_id: firstProdus?.produs_id ?? null,
          produs_nume_manual: firstProdus?.produs_nume_manual ?? '',
          dozaUnitate: typeof firstProdus?.doza_l_per_ha === 'number' && firstProdus.doza_l_per_ha > 0 ? 'l/ha' : 'ml/hl',
          doza: typeof firstProdus?.doza_l_per_ha === 'number' && firstProdus.doza_l_per_ha > 0 ? firstProdus.doza_l_per_ha : firstProdus?.doza_ml_per_hl ?? 0,
          observatii: linie.observatii ?? '',
          produse,
        }
      })
    ),
    revizuire: {
      an: anImplicit,
      parcele_ids: [...new Set(plan.parcele_asociate.map((parcela) => parcela.parcela_id))],
    },
  }
}

export function duplicatePlanForWizard(plan: PlanTratamentComplet): PlanWizardValues {
  const values = planToWizardValues(plan)

  return {
    info: {
      ...values.info,
      nume: `${values.info.nume} (copie)`,
    },
    linii: values.linii.map((linie, index) => ({
      ...linie,
      id: `copie-${index + 1}-${linie.id}`,
    })),
    revizuire: {
      an: getCurrentSezon(),
      parcele_ids: [],
    },
  }
}
