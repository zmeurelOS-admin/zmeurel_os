import { listCulturiPentruPlanWizardAction } from '@/app/(dashboard)/tratamente/planuri/actions'

import { PlanGolClient } from './PlanGolClient'

export default async function PlanGolPage() {
  const culturi = await listCulturiPentruPlanWizardAction()
  return <PlanGolClient culturi={culturi} />
}
