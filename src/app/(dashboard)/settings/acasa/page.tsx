'use client'

import { AppShell } from '@/components/app/AppShell'
import { AcasaSection } from '@/components/setari/SetariFerma'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'

export default function SettingsAcasaPage() {
  return (
    <AppShell header={<ScreenHeader title="Ce arată Acasă" backHref="/settings" />}>
      <ScreenBody>
        <AcasaSection />
      </ScreenBody>
    </AppShell>
  )
}
