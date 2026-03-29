import { BottomTabBar } from '@/components/app/BottomTabBar'
import { DemoBanner } from '@/components/app/DemoBanner'
import { AiPanel } from '@/components/ai/AiPanel'
import { Sidebar } from '@/components/layout/Sidebar'
import AiFab from '@/components/ui/AiFab'
import ManualAddFab from '@/components/ui/ManualAddFab'
import { AiPanelProvider } from '@/contexts/AiPanelContext'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

import { Providers } from '../providers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const headerStore = await headers()
  const userIdFromProxy = headerStore.get('x-zmeurel-user-id')
  const emailFromProxy = headerStore.get('x-zmeurel-user-email')

  const {
    data: { user },
  } = userIdFromProxy
    ? { data: { user: { id: userIdFromProxy, email: emailFromProxy } } }
    : await supabase.auth.getUser()

  if (!user) {
    throw new Error('DashboardLayout requires an authenticated user. Access should be guarded by src/proxy.ts.')
  }

  const initialAuth = {
    userId: user.id,
    email: user.email ?? null,
    isSuperAdmin: await isSuperAdmin(supabase, user.id),
  }

  return (
    <Providers initialAuth={initialAuth}>
      <AiPanelProvider>
        <div className="hidden min-h-screen bg-[var(--agri-bg)] md:block">
          <DemoBanner />
          <Sidebar />
          <main className="min-h-screen transition-[margin-left] duration-300 ease-in-out md:ml-[var(--sidebar-width)]">
            <div className="min-h-screen">{children}</div>
          </main>
          <AiPanel />
        </div>

        <div className="bg-[var(--agri-bg)] md:hidden">
          <DemoBanner />
          {children}
          <BottomTabBar />
        </div>

        <AiFab />
        <ManualAddFab />
      </AiPanelProvider>
    </Providers>
  )
}
