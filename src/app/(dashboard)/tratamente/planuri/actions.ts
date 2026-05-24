'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  arhiveazaPlanTratament,
  createPlanTratament,
  dezarhiveazaPlanTratament,
  countAplicariPlan,
  listCulturiPentruPlanWizard,
  listParcelePentruPlanWizard,
  listPlanuriTratamentComplet,
  listProduseFitosanitare,
  upsertPlanTratamentCuLinii,
  type PlanTratamentComplet,
  type PlanTratamentLiniePayload,
  type PlanTratamentListItem,
  type PlanWizardParcelaOption,
  type ProdusFitosanitar,
  type UpsertPlanTratamentPayload,
} from '@/lib/supabase/queries/tratamente'

function revalidatePlanuriPaths(planId?: string) {
  revalidatePath('/tratamente/planuri')
  revalidatePath('/tratamente/planuri/nou')
  if (planId) {
    revalidatePath(`/tratamente/planuri/${planId}`)
    revalidatePath(`/tratamente/planuri/${planId}/editeaza`)
    revalidatePath(`/tratamente/planuri/${planId}/editor`)
  }
}

const planGolSchema = z.object({
  nume: z.string().trim().min(1, 'Numele planului este obligatoriu.').max(120, 'Numele planului poate avea cel mult 120 de caractere.'),
  culturaTip: z.string().trim().min(1, 'Alege cultura pentru plan.').max(80, 'Cultura poate avea cel mult 80 de caractere.'),
})

export async function listPlanuriTratamentCompletAction(opts?: {
  culturaTip?: string
  activ?: boolean
  arhivat?: boolean
}): Promise<PlanTratamentListItem[]> {
  return listPlanuriTratamentComplet(opts)
}

export async function getPlanDeleteInfoAction(planId: string): Promise<{ countAplicari: number }> {
  return {
    countAplicari: await countAplicariPlan(planId),
  }
}

export async function listCulturiPentruPlanWizardAction(): Promise<string[]> {
  return listCulturiPentruPlanWizard()
}

export async function listProduseFitosanitarePentruPlanWizardAction(): Promise<ProdusFitosanitar[]> {
  return listProduseFitosanitare({ activ: true })
}

export async function listParcelePentruPlanWizardAction(
  culturaTip?: string | null
): Promise<PlanWizardParcelaOption[]> {
  return listParcelePentruPlanWizard(culturaTip)
}

export async function creeazaPlanGolAction(input: {
  nume: string
  culturaTip: string
}): Promise<{ planId: string }> {
  const parsed = planGolSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Nu am putut crea planul.')
  }

  const result = await createPlanTratament(
    {
      nume: parsed.data.nume,
      cultura_tip: parsed.data.culturaTip,
      descriere: null,
      activ: true,
      arhivat: false,
    },
    []
  )
  revalidatePlanuriPaths(result.id)
  return { planId: result.id }
}

export async function upsertPlanTratamentCuLiniiAction(
  planData: UpsertPlanTratamentPayload,
  liniiData: PlanTratamentLiniePayload[],
  parceleIds: string[] | null | undefined,
  an: number
): Promise<PlanTratamentComplet> {
  const result = await upsertPlanTratamentCuLinii(planData, liniiData, parceleIds, an)
  revalidatePlanuriPaths(result.id)
  return result
}

export async function arhiveazaPlanTratamentAction(planId: string) {
  const result = await arhiveazaPlanTratament(planId)
  revalidatePlanuriPaths(planId)
  return result
}

export async function dezarhiveazaPlanTratamentAction(planId: string) {
  const result = await dezarhiveazaPlanTratament(planId)
  revalidatePlanuriPaths(planId)
  return result
}
