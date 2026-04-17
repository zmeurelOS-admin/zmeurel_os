import * as z from 'zod'

import type {
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

export const linieDraftSchema = z
  .object({
    id: z.string().min(1),
    ordine: z.number().int().positive(),
    stadiu_trigger: z.string().trim().min(1, 'Alege stadiul fenologic.'),
    produs_id: z.string().trim().optional().nullable(),
    produs_nume_manual: z.string().trim().max(120, 'Numele manual poate avea cel mult 120 de caractere.').optional().nullable(),
    dozaUnitate: linieDozaUnitSchema,
    doza: z.number({ error: 'Introduceți doza.' }).positive('Doza trebuie să fie mai mare decât 0.'),
    observatii: z.string().trim().max(500, 'Observațiile pot avea cel mult 500 de caractere.').optional().or(z.literal('')),
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

export const asociereSchema = z.object({
  an: z.number().int().min(2020, 'Anul trebuie să fie valid.').max(2100, 'Anul trebuie să fie valid.'),
  parcele_ids: z.array(z.string()).default([]),
})

export type PlanWizardInfoData = z.infer<typeof planInfoSchema>
export type LinieDozaUnitate = z.infer<typeof linieDozaUnitSchema>
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

export function normalizeOptionalText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export function createEmptyLine(nextOrdine: number): PlanWizardLinieDraft {
  return {
    id: crypto.randomUUID(),
    ordine: nextOrdine,
    stadiu_trigger: '',
    produs_id: null,
    produs_nume_manual: '',
    dozaUnitate: 'ml/hl',
    doza: 0,
    observatii: '',
  }
}

export function ensureConsecutiveOrdine(linii: PlanWizardLinieDraft[]): PlanWizardLinieDraft[] {
  return [...linii].map((linie, index) => ({
    ...linie,
    ordine: index + 1,
  }))
}

export function lineToPayload(linie: PlanWizardLinieDraft): PlanTratamentLiniePayload {
  return {
    ordine: linie.ordine,
    stadiu_trigger: linie.stadiu_trigger,
    produs_id: linie.produs_id?.trim() ? linie.produs_id : null,
    produs_nume_manual: linie.produs_nume_manual?.trim() ? linie.produs_nume_manual.trim() : null,
    doza_ml_per_hl: linie.dozaUnitate === 'ml/hl' ? linie.doza : null,
    doza_l_per_ha: linie.dozaUnitate === 'l/ha' ? linie.doza : null,
    observatii: linie.observatii?.trim() ? linie.observatii.trim() : null,
  }
}

export function planToWizardValues(plan: PlanTratamentComplet): PlanWizardValues {
  const anImplicit = plan.parcele_asociate[0]?.an ?? new Date().getFullYear()

  return {
    info: {
      nume: plan.nume,
      cultura_tip: plan.cultura_tip,
      descriere: plan.descriere ?? '',
    },
    linii: ensureConsecutiveOrdine(
      plan.linii.map((linie, index) => ({
        id: linie.id || `linie-${index + 1}`,
        ordine: linie.ordine ?? index + 1,
        stadiu_trigger: linie.stadiu_trigger,
        produs_id: linie.produs_id ?? null,
        produs_nume_manual: linie.produs_nume_manual ?? '',
        dozaUnitate: typeof linie.doza_l_per_ha === 'number' && linie.doza_l_per_ha > 0 ? 'l/ha' : 'ml/hl',
        doza: typeof linie.doza_l_per_ha === 'number' && linie.doza_l_per_ha > 0 ? linie.doza_l_per_ha : linie.doza_ml_per_hl ?? 0,
        observatii: linie.observatii ?? '',
      }))
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
      an: new Date().getFullYear(),
      parcele_ids: [],
    },
  }
}
