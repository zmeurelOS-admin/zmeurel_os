import { Sidebar } from '@/components/layout/Sidebar'
import { BottomTabBar } from '@/components/app/BottomTabBar'
import { DemoBanner } from '@/components/app/DemoBanner'
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
      <div className="hidden lg:flex lg:min-h-screen lg:flex-col bg-[var(--agri-bg)]">
        <DemoBanner />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="min-h-screen">{children}</div>
          </main>
        </div>
      </div>

      <div className="bg-[var(--agri-bg)] lg:hidden">
        <DemoBanner />
        {children}
        <BottomTabBar />
      </div>
    </Providers>
  )
}
