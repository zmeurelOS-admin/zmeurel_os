import { BottomTabBar } from '@/components/app/BottomTabBar'
import { DashboardContextSync } from '@/components/app/DashboardContextSync'
import { DemoBanner } from '@/components/app/DemoBanner'
import { DashboardSidebarLoader } from '@/components/layout/DashboardSidebarLoader'
import {
  DashboardShellFloatingOverlays,
  DashboardShellTopSlot,
} from '@/components/layout/DashboardShellSlots'
import { LegalDocsPersistentBanner } from '@/components/legal-docs/LegalDocsPersistentBanner'
import UnifiedMobileFab from '@/components/ui/UnifiedMobileFab'
import { AiPanelProvider } from '@/contexts/AiPanelContext'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { getAssociationRole } from '@/lib/association/auth'
import { parseFarmMemberAccessHeader } from '@/lib/farm-members/access'
import { getTenantLegalDocs } from '@/lib/legal-docs/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

import { Providers } from '../providers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const headerStore = await headers()
  const userIdFromProxy = headerStore.get('x-zmeurel-user-id')
  const emailFromProxy = headerStore.get('x-zmeurel-user-email')
  const tenantIdFromProxy = headerStore.get('x-zmeurel-tenant-id')
  const memberRoleFromProxy: 'operator' | null =
    headerStore.get('x-zmeurel-member-role') === 'operator' ? 'operator' : null
  const memberAccess = parseFarmMemberAccessHeader(headerStore.get('x-zmeurel-member-modules'))
  const accessLevelFromProxy = headerStore.get('x-zmeurel-access-level')
  const accessLevel: 'read' | 'write' | null =
    accessLevelFromProxy === 'read' || accessLevelFromProxy === 'write' ? accessLevelFromProxy : null

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
  let shouldShowLegalDocsBanner = false
  const tenantIdForAuth =
    typeof tenantIdFromProxy === 'string' && tenantIdFromProxy ? tenantIdFromProxy : null
  if (tenantIdForAuth) {
    const [{ data: tenantRow }, legalDocs] = await Promise.all([
      supabase
        .from('tenants')
        .select('is_association_approved, nume_ferma')
        .eq('id', tenantIdForAuth)
        .maybeSingle(),
      getTenantLegalDocs(supabase, tenantIdForAuth),
    ])
    associationShopApproved = tenantRow?.is_association_approved === true
    farmName = tenantRow?.nume_ferma ?? null
    shouldShowLegalDocsBanner = !legalDocs.status.complete
  }

  const initialAuth = {
    userId: user.id,
    email: user.email ?? null,
    isSuperAdmin: await isSuperAdmin(supabase, user.id),
    tenantId: tenantIdForAuth,
    associationShopApproved,
    associationRole: await getAssociationRole(user.id),
    farmName,
    memberRole: memberRoleFromProxy,
    memberAccess,
    accessModule: headerStore.get('x-zmeurel-access-module'),
    accessLevel,
  }

  return (
    <Providers initialAuth={initialAuth}>
      <AiPanelProvider>
        <DashboardContextSync />
        <div className="min-h-screen bg-[var(--agri-bg)]">
          <DemoBanner />
          {shouldShowLegalDocsBanner ? <LegalDocsPersistentBanner /> : null}
          <DashboardShellTopSlot />
          <DashboardSidebarLoader />
          <main className="min-h-screen transition-[margin-left] duration-300 ease-in-out md:ml-[var(--sidebar-width)]">
            {children}
          </main>
          <DashboardShellFloatingOverlays />
          <BottomTabBar />
          <UnifiedMobileFab />
        </div>
      </AiPanelProvider>
    </Providers>
  )
}
