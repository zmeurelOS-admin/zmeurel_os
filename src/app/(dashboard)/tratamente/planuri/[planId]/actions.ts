'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  addLinieToPlan,
  arhiveazaPlanTratament,
  assignPlanToParcela,
  countAplicariPlan,
  deactivateParcelaPlan,
  deleteLiniePlan,
  detachAplicariDeLinie,
  duplicatePlanTratament,
  getLiniePlanContext,
  getPlanTratamentComplet,
  hardDeletePlanTratament,
  mapTratamenteError,
  reorderLiniiPlan,
  type CreatePlanTratamentLinieInput,
  type CreatePlanTratamentInput,
  type LiniePlanContext,
  updateLiniePlan,
  updatePlanTratament,
  dezarhiveazaPlanTratament,
} from '@/lib/supabase/queries/tratamente'

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type LinieInput = Omit<CreatePlanTratamentLinieInput, 'ordine'> & {
  stadiu_trigger: string
}

const planInfoSchema = z.object({
  nume: z.string().trim().min(1, 'Numele planului este obligatoriu.').max(120, 'Numele planului poate avea cel mult 120 de caractere.'),
  descriere: z.string().trim().max(500, 'Descrierea poate avea cel mult 500 de caractere.').optional().nullable(),
})

const duplicateSchema = z.object({
  planId: z.string().uuid('Planul selectat nu este valid.'),
  numeNou: z.string().trim().min(1, 'Numele noului plan este obligatoriu.').max(120, 'Numele noului plan poate avea cel mult 120 de caractere.'),
})

const linieSchema = z
  .object({
    stadiu_trigger: z.string().trim().min(1, 'Stadiul fenologic este obligatoriu.'),
    cohort_trigger: z.enum(['floricane', 'primocane']).optional().nullable(),
    sursa_linie: z.enum(['din_plan', 'adaugata_manual']).optional(),
    motiv_adaugare: z.string().trim().max(500, 'Motivul poate avea cel mult 500 de caractere.').optional().nullable(),
    tip_interventie: z.enum(['protectie', 'nutritie', 'biostimulare', 'erbicidare', 'igiena', 'monitorizare', 'altul']).optional().nullable(),
    scop: z.string().trim().max(240, 'Scopul poate avea cel mult 240 de caractere.').optional().nullable(),
    regula_repetare: z.enum(['fara_repetare', 'interval']).optional(),
    interval_repetare_zile: z.number().int().min(1).optional().nullable(),
    numar_repetari_max: z.number().int().min(1).optional().nullable(),
    produs_id: z.string().uuid().optional().nullable(),
    produs_nume_manual: z.string().trim().max(120, 'Numele manual poate avea cel mult 120 de caractere.').optional().nullable(),
    doza_ml_per_hl: z.number().positive('Doza trebuie să fie mai mare decât 0.').optional().nullable(),
    doza_l_per_ha: z.number().positive('Doza trebuie să fie mai mare decât 0.').optional().nullable(),
    observatii: z.string().trim().max(500, 'Observațiile pot avea cel mult 500 de caractere.').optional().nullable(),
    produse: z.array(
      z.object({
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
        cantitate_text: z.string().trim().max(160).optional().nullable(),
        observatii: z.string().trim().max(500).optional().nullable(),
      }).superRefine((value, ctx) => {
        const hasProdusId = typeof value.produs_id === 'string' && value.produs_id.trim().length > 0
        const hasManual = typeof value.produs_nume_manual === 'string' && value.produs_nume_manual.trim().length > 0

        if (!hasProdusId && !hasManual) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['produs_id'],
            message: 'Alege un produs sau completează numele manual.',
          })
        }
      })
    ).min(1, 'Intervenția trebuie să aibă cel puțin un produs.').optional(),
  })
  .superRefine((value, ctx) => {
    const hasV2Products = Array.isArray(value.produse) && value.produse.length > 0
    const hasProdusId = typeof value.produs_id === 'string' && value.produs_id.trim().length > 0
    const hasManual = typeof value.produs_nume_manual === 'string' && value.produs_nume_manual.trim().length > 0

    if (!hasV2Products && !hasProdusId && !hasManual) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['produs_id'],
        message: 'Alege un produs sau completează numele manual.',
      })
    }

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

    if (
      value.sursa_linie === 'adaugata_manual' &&
      (!value.motiv_adaugare || value.motiv_adaugare.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['motiv_adaugare'],
        message: 'Motivul adăugării este obligatoriu pentru intervențiile manuale.',
      })
    }
  })

const reorderSchema = z.object({
  planId: z.string().uuid('Planul selectat nu este valid.'),
  orderedIds: z.array(z.string().uuid('Ordinea liniilor conține un ID invalid.')).min(1, 'Ordinea liniilor nu poate fi goală.'),
})

const assignSchema = z.object({
  planId: z.string().uuid('Planul selectat nu este valid.'),
  parcelaId: z.string().uuid('Parcela selectată nu este validă.'),
  an: z.number().int().min(2020).max(2100),
})

function toActionError<T = undefined>(error: unknown, fallback: string): ActionResult<T> {
  return {
    ok: false,
    error: mapTratamenteError(error, fallback).message,
  }
}

function revalidatePlanPaths(planId: string) {
  revalidatePath('/tratamente/planuri')
  revalidatePath(`/tratamente/planuri/${planId}`)
  revalidatePath(`/tratamente/planuri/${planId}/editeaza`)
}

function success<T = undefined>(data: T): ActionResult<T> {
  return { ok: true, data }
}

async function getLinieContextOrError(linieId: string): Promise<LiniePlanContext> {
  const linie = await getLiniePlanContext(linieId)
  if (!linie) {
    throw new Error('Linia selectată nu a fost găsită.')
  }
  return linie
}

export async function updatePlanInfoAction(
  planId: string,
  formData: { nume: string; descriere?: string | null }
): Promise<ActionResult> {
  const parsed = planInfoSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Nu am putut actualiza planul.' }
  }

  try {
    await updatePlanTratament(planId, {
      nume: parsed.data.nume,
      descriere: parsed.data.descriere ?? null,
    } satisfies Partial<CreatePlanTratamentInput>)
    revalidatePlanPaths(planId)
    return success(undefined)
  } catch (error) {
    return toActionError(error, 'Nu am putut actualiza informațiile planului.')
  }
}

export async function deactivatePlanAction(planId: string): Promise<ActionResult> {
  try {
    await arhiveazaPlanTratament(planId)
    revalidatePlanPaths(planId)
    return success(undefined)
  } catch (error) {
    return toActionError(error, 'Nu am putut dezactiva planul.')
  }
}

export async function reactivatePlanAction(planId: string): Promise<ActionResult> {
  try {
    await dezarhiveazaPlanTratament(planId)
    revalidatePlanPaths(planId)
    return success(undefined)
  } catch (error) {
    return toActionError(error, 'Nu am putut reactiva planul.')
  }
}

export async function duplicatePlanAction(
  planId: string,
  numeNou: string
): Promise<ActionResult<{ planIdNou: string }>> {
  const parsed = duplicateSchema.safeParse({ planId, numeNou })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Nu am putut duplica planul.' }
  }

  try {
    const duplicated = await duplicatePlanTratament(parsed.data.planId, parsed.data.numeNou)
    revalidatePlanPaths(planId)
    revalidatePlanPaths(duplicated.id)
    return success({ planIdNou: duplicated.id })
  } catch (error) {
    return toActionError<{ planIdNou: string }>(error, 'Nu am putut duplica planul.')
  }
}

export async function hardDeletePlanAction(planId: string): Promise<ActionResult> {
  try {
    await hardDeletePlanTratament(planId)
    revalidatePath('/tratamente/planuri')
    return success(undefined)
  } catch (error) {
    return toActionError(error, 'Nu am putut șterge planul.')
  }
}

export async function addLinieAction(
  planId: string,
  formData: LinieInput
): Promise<ActionResult<{ linieId: string }>> {
  const parsed = linieSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Nu am putut adăuga linia.' }
  }

  try {
    const linie = await addLinieToPlan(planId, parsed.data)
    revalidatePlanPaths(planId)
    return success({ linieId: linie.id })
  } catch (error) {
    return toActionError<{ linieId: string }>(error, 'Nu am putut adăuga linia în plan.')
  }
}

export async function updateLinieAction(
  linieId: string,
  formData: LinieInput
): Promise<ActionResult> {
  const parsed = linieSchema.safeParse(formData)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Nu am putut actualiza linia.' }
  }

  try {
    const context = await getLinieContextOrError(linieId)
    await updateLiniePlan(linieId, parsed.data)
    revalidatePlanPaths(context.plan_id)
    return success(undefined)
  } catch (error) {
    return toActionError(error, 'Nu am putut actualiza linia.')
  }
}

export async function deleteLinieAction(linieId: string): Promise<ActionResult> {
  try {
    const context = await getLinieContextOrError(linieId)
    await detachAplicariDeLinie(linieId)
    await deleteLiniePlan(linieId)

    const plan = await getPlanTratamentComplet(context.plan_id)
    if (plan && plan.linii.length > 0) {
      await reorderLiniiPlan(context.plan_id, plan.linii.map((linie) => linie.id))
    }

    revalidatePlanPaths(context.plan_id)
    return success(undefined)
  } catch (error) {
    return toActionError(error, 'Nu am putut șterge linia din plan.')
  }
}

export async function reorderLiniiAction(
  planId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  const parsed = reorderSchema.safeParse({ planId, orderedIds })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Nu am putut reordona liniile.' }
  }

  try {
    await reorderLiniiPlan(parsed.data.planId, parsed.data.orderedIds)
    revalidatePlanPaths(parsed.data.planId)
    return success(undefined)
  } catch (error) {
    return toActionError(error, 'Nu am putut salva noua ordine a liniilor.')
  }
}

export async function assignParcelaToPlanAction(
  planId: string,
  parcelaId: string,
  an: number
): Promise<ActionResult> {
  const parsed = assignSchema.safeParse({ planId, parcelaId, an })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Nu am putut asigna planul.' }
  }

  try {
    await assignPlanToParcela(parsed.data.parcelaId, parsed.data.planId, parsed.data.an)
    revalidatePlanPaths(parsed.data.planId)
    revalidatePath(`/parcele/${parsed.data.parcelaId}/tratamente`)
    return success(undefined)
  } catch (error) {
    return toActionError(error, 'Nu am putut asigna planul la parcelă.')
  }
}

export async function deactivateParcelaPlanAction(
  parcelaPlanId: string
): Promise<ActionResult> {
  if (!parcelaPlanId) {
    return { ok: false, error: 'Asocierea selectată nu este validă.' }
  }

  try {
    const result = await deactivateParcelaPlan(parcelaPlanId)
    revalidatePlanPaths(result.plan_id)
    revalidatePath(`/parcele/${result.parcela_id}/tratamente`)
    return success(undefined)
  } catch (error) {
    return toActionError(error, 'Nu am putut dezactiva asocierea planului pe parcelă.')
  }
}

export async function getPlanAplicariCountAction(planId: string): Promise<ActionResult<{ count: number }>> {
  try {
    const count = await countAplicariPlan(planId)
    return success({ count })
  } catch (error) {
    return toActionError<{ count: number }>(error, 'Nu am putut încărca numărul de aplicări asociate.')
  }
}
