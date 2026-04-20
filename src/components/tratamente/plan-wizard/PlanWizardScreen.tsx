'use client'

import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { PlanWizard } from '@/components/tratamente/plan-wizard/PlanWizard'
import type { PlanTratamentComplet } from '@/lib/supabase/queries/tratamente'
import type { ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import { toast } from '@/lib/ui/toast'

interface PlanWizardScreenProps {
  initialData?: PlanTratamentComplet
  configurareSezon?: ConfigurareSezon | null
  preselectedParcelaId?: string
  subtitle: string
  successMessage: string
  title: string
}

export function PlanWizardScreen({
  configurareSezon,
  initialData,
  preselectedParcelaId,
  subtitle,
  successMessage,
  title,
}: PlanWizardScreenProps) {
  const router = useRouter()

  return (
    <AppShell header={<PageHeader title={title} subtitle={subtitle} expandRightSlotOnMobile />}>
      <div className="mx-auto w-full max-w-7xl px-0 py-3 md:py-4">
        <PlanWizard
          configurareSezon={configurareSezon}
          initialData={initialData}
          preselectedParcelaId={preselectedParcelaId}
          onCancel={() => {
            const confirmed = window.confirm('Renunți la modificările nesalvate?')
            if (!confirmed) return
            router.push('/tratamente/planuri')
          }}
          onSave={(result) => {
            toast.success(successMessage)
            router.push('/tratamente/planuri')
            router.refresh()
          }}
        />
      </div>
    </AppShell>
  )
}
