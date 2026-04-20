import { notFound } from 'next/navigation'

import { PlanWizardScreen } from '@/components/tratamente/plan-wizard/PlanWizardScreen'
import { getPlanTratamentComplet } from '@/lib/supabase/queries/tratamente'
import { getConfigurareSezon } from '@/lib/supabase/queries/configurari-sezon'
import { getCurrentSezon } from '@/lib/utils/sezon'

type PageProps = {
  params: Promise<{ planId: string }>
}

export default async function TratamentePlanEditPage({ params }: PageProps) {
  const { planId } = await params
  const plan = await getPlanTratamentComplet(planId)

  if (!plan) {
    notFound()
  }

  const configurareSezon = plan.parcele_asociate[0]?.parcela_id
    ? await getConfigurareSezon(plan.parcele_asociate[0].parcela_id, getCurrentSezon())
    : null

  return (
    <PlanWizardScreen
      configurareSezon={configurareSezon}
      initialData={plan}
      subtitle="Actualizează liniile și asocierile existente"
      successMessage="Planul de tratament a fost actualizat."
      title="Editează plan"
    />
  )
}
