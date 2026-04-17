import { notFound } from 'next/navigation'

import { PlanWizardScreen } from '@/components/tratamente/plan-wizard/PlanWizardScreen'
import { getPlanTratamentComplet } from '@/lib/supabase/queries/tratamente'

type PageProps = {
  params: Promise<{ planId: string }>
}

export default async function TratamentePlanEditPage({ params }: PageProps) {
  const { planId } = await params
  const plan = await getPlanTratamentComplet(planId)

  if (!plan) {
    notFound()
  }

  return (
    <PlanWizardScreen
      initialData={plan}
      subtitle="Actualizează liniile și asocierile existente"
      successMessage="Planul de tratament a fost actualizat."
      title="Editează plan"
    />
  )
}
