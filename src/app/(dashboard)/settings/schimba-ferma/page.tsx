'use client'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { FarmSwitcher } from '@/components/app/FarmSwitcher'
import { Notice } from '@/components/kit'
import { ScreenBody, ScreenHeader } from '@/components/setari/SetariUi'

/** Doar pentru cine vedea și înainte „Schimbă fermă” (superadmin). */
export default function SettingsSchimbaFermaPage() {
  const { isSuperAdmin } = useDashboardAuth()
  return (
    <AppShell header={<ScreenHeader title="Schimbă ferma" backHref="/settings" />}>
      <ScreenBody>
        {isSuperAdmin ? <FarmSwitcher variant="panel" /> : <Notice tone="info" title="Contul tău are o singură fermă." />}
      </ScreenBody>
    </AppShell>
  )
}
