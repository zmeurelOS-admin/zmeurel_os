import { BottomTabBar } from '@/components/app/BottomTabBar'
import { DashboardContextSync } from '@/components/app/DashboardContextSync'
import { DemoBanner } from '@/components/app/DemoBanner'
import { PushPermissionBanner } from '@/components/notifications/PushPermissionBanner'
import { AiPanel } from '@/components/ai/AiPanel'
import { DashboardSidebarLoader } from '@/components/layout/DashboardSidebarLoader'
import UnifiedMobileFab from '@/components/ui/UnifiedMobileFab'
import { AiPanelProvider } from '@/contexts/AiPanelContext'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { getAssociationRole } from '@/lib/association/auth'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

import { Providers } from '../providers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const headerStore = await headers()
  const userIdFromProxy = headerStore.get('x-zmeurel-user-id')
  const emailFromProxy = headerStore.get('x-zmeurel-user-email')
  const tenantIdFromProxy = headerStore.get('x-zmeurel-tenant-id')

  const {
    data: { user },
  } = userIdFromProxy
    ? { data: { user: { id: userIdFromProxy, email: emailFromProxy } } }
    : await supabase.auth.getUser()

  if (!user) {
    throw new Error('DashboardLayout requires an authenticated user. Access should be guarded by src/proxy.ts.')
  }

  let associationShopApproved = false
  let farmName: string | null = null
  const tenantIdForAuth =
    typeof tenantIdFromProxy === 'string' && tenantIdFromProxy ? tenantIdFromProxy : null
  if (tenantIdForAuth) {
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('is_association_approved, nume_ferma')
      .eq('id', tenantIdForAuth)
      .maybeSingle()
    associationShopApproved = tenantRow?.is_association_approved === true
    farmName = tenantRow?.nume_ferma ?? null
  }

  const initialAuth = {
    userId: user.id,
    email: user.email ?? null,
    isSuperAdmin: await isSuperAdmin(supabase, user.id),
    tenantId: tenantIdForAuth,
    associationShopApproved,
    associationRole: await getAssociationRole(user.id),
    farmName,
  }

  return (
    <Providers initialAuth={initialAuth}>
      <AiPanelProvider>
        <DashboardContextSync />
        <div className="min-h-screen bg-[var(--agri-bg)]">
          <DemoBanner />
          <PushPermissionBanner />
          <DashboardSidebarLoader />
          <main className="min-h-screen transition-[margin-left] duration-300 ease-in-out md:ml-[var(--sidebar-width)]">
            {children}
          </main>
          <AiPanel />
          <BottomTabBar />
          <UnifiedMobileFab />
        </div>
      </AiPanelProvider>
    </Providers>
  )
}
