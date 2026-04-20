import { PlanWizardScreen } from '@/components/tratamente/plan-wizard/PlanWizardScreen'
import { getPlanTratamentComplet } from '@/lib/supabase/queries/tratamente'
import { getConfigurareSezon } from '@/lib/supabase/queries/configurari-sezon'
import { getCurrentSezon } from '@/lib/utils/sezon'

type PageProps = {
  searchParams: Promise<{
    duplicate_from?: string
    parcela_id?: string
  }>
}

export default async function TratamentePlanNouPage({ searchParams }: PageProps) {
  const params = await searchParams
  const duplicateFrom = params.duplicate_from?.trim()
  const preselectedParcelaId = params.parcela_id?.trim()

  const [duplicatePlan, configurareSezon] = await Promise.all([
    duplicateFrom ? getPlanTratamentComplet(duplicateFrom) : Promise.resolve(null),
    preselectedParcelaId ? getConfigurareSezon(preselectedParcelaId, getCurrentSezon()) : Promise.resolve(null),
  ])

  const initialData = duplicatePlan
    ? {
        ...duplicatePlan,
        id: '',
        nume: `${duplicatePlan.nume} (copie)`,
        parcele_asociate: [],
      }
    : undefined

  return (
    <PlanWizardScreen
      configurareSezon={configurareSezon}
      initialData={initialData}
      preselectedParcelaId={preselectedParcelaId}
      subtitle="Construiește strategia sezonieră în 3 pași"
      successMessage="Planul de tratament a fost salvat."
      title="Plan nou"
    />
  )
}
