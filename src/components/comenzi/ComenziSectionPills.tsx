'use client'

import { usePathname, useRouter } from 'next/navigation'

import {
  ModulePillFilterButton,
  ModulePillRow,
} from '@/components/app/module-list-chrome'

export type ComenziSection = 'comenzi'

export function ComenziSectionPills({
  section = 'comenzi',
  onSectionChange,
}: {
  section?: ComenziSection
  onSectionChange?: (section: ComenziSection) => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const campaignActive = pathname.startsWith('/comenzi/campanie')

  const openSection = (nextSection: ComenziSection) => {
    if (campaignActive || !onSectionChange) {
      router.push('/comenzi')
      return
    }
    onSectionChange(nextSection)
  }

  return (
    <ModulePillRow>
      <ModulePillFilterButton
        active={!campaignActive && section === 'comenzi'}
        onClick={() => openSection('comenzi')}
      >
        Comenzi
      </ModulePillFilterButton>
      <ModulePillFilterButton
        active={campaignActive}
        onClick={() => router.push('/comenzi/campanie')}
      >
        Campanie 🎯
      </ModulePillFilterButton>
    </ModulePillRow>
  )
}
