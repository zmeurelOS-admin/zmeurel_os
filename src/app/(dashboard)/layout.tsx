import { redirect } from 'next/navigation'

import { Sidebar } from '@/components/layout/Sidebar'
import { BottomTabBar } from '@/components/app/BottomTabBar'
import { BetaBanner } from '@/components/app/BetaBanner'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { createClient } from '@/lib/supabase/server'
import { Providers } from '../providers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const initialAuth = {
    userId: user.id,
    email: user.email ?? null,
    isSuperAdmin: await isSuperAdmin(supabase, user.id),
  }

  return (
    <Providers initialAuth={initialAuth}>
      <div className="hidden min-h-screen bg-[var(--agri-bg)] lg:flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <BetaBanner />
          <div className="min-h-screen">{children}</div>
        </main>
      </div>

      <div className="bg-[var(--agri-bg)] lg:hidden">
        <BetaBanner />
        {children}
        <BottomTabBar />
      </div>
    </Providers>
  )
}
