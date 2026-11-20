'use client'

import { AppShell } from '@/components/app/AppShell'
import { PretStandardSection } from '@/components/setari/SetariFerma'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'

export default function SettingsPretStandardPage() {
  return (
    <AppShell header={<ScreenHeader title="Prețul standard" backHref="/settings" />}>
      <ScreenBody>
        <PretStandardSection />
      </ScreenBody>
    </AppShell>
  )
}
