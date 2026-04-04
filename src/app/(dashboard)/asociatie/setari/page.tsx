import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { AssociationSettingsClient } from '@/components/association/settings/AssociationSettingsClient'
import { requireAssociationAccess } from '@/lib/association/auth'
import { loadAssociationSettings } from '@/lib/association/public-settings'

export default async function AsociatieSetariPage() {
  await requireAssociationAccess('moderator')
  const settings = await loadAssociationSettings()

  return (
    <AppShell header={<PageHeader title="Setări" subtitle="Asociație — Gustă din Bucovina" />}>
      <AssociationSettingsClient initialSettings={settings} />
    </AppShell>
  )
}
