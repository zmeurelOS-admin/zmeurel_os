'use server'

import {
  listProduseFitosanitare,
  createProdusFitosanitar,
  updateProdusFitosanitar,
  deleteProdusFitosanitar,
  isProdusFolositInPlanActiv,
  type InsertTenantProdus,
  type ProdusFitosanitar,
} from '@/lib/supabase/queries/tratamente'

export async function listProduseFitosanitareAction(): Promise<ProdusFitosanitar[]> {
  return listProduseFitosanitare()
}

export async function createProdusFitosanitarAction(
  data: InsertTenantProdus
): Promise<ProdusFitosanitar> {
  return createProdusFitosanitar(data)
}

export async function updateProdusFitosanitarAction(
  id: string,
  data: Partial<InsertTenantProdus>
): Promise<ProdusFitosanitar> {
  return updateProdusFitosanitar(id, data)
}

export async function deleteProdusFitosanitarAction(id: string): Promise<void> {
  return deleteProdusFitosanitar(id)
}

export async function isProdusFolositInPlanActivAction(
  id: string
): Promise<{ folosit: boolean; planuri: Array<{ id: string; denumire: string }> }> {
  return isProdusFolositInPlanActiv(id)
}

export async function duplicaProdusFitosanitarAction(
  data: InsertTenantProdus
): Promise<ProdusFitosanitar> {
  return createProdusFitosanitar(data)
}
