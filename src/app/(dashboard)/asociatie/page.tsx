import { AssociationDashboardClient } from '@/components/association/dashboard/AssociationDashboardClient'
import { requireAssociationAccess } from '@/lib/association/auth'
import { loadAssociationSettingsCached } from '@/lib/association/public-settings'
import { getAssociationDashboardPageData } from '@/lib/association/queries'
import { isMerchantComplianceComplete } from '@/lib/shop/association/merchant-info'

export default async function AsociatieDashboardPage() {
  await requireAssociationAccess()
  const [stats, settings] = await Promise.all([
    getAssociationDashboardPageData(),
    loadAssociationSettingsCached(),
  ])
  return (
    <AssociationDashboardClient
      stats={stats}
      merchantComplianceComplete={isMerchantComplianceComplete(settings)}
    />
  )
}
