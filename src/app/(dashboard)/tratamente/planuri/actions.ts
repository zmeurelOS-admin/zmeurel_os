'use server'

import { revalidatePath } from 'next/cache'

import {
  arhiveazaPlanTratament,
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
  }
}

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
