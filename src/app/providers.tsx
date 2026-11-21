'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { DensityProvider } from '@/components/app/DensityProvider'
import {
  DashboardAuthProvider,
  type DashboardAuthValue,
} from '@/components/app/DashboardAuthContext'
import { NavigationPerfLogger } from '@/components/app/NavigationPerfLogger'
import { PageViewTracker } from '@/components/app/PageViewTracker'
import { RouteTransitionIndicator } from '@/components/app/RouteTransitionIndicator'
import { NotificationToastProvider } from '@/components/notifications/NotificationToastProvider'
import { AddActionProvider } from '@/contexts/AddActionContext'
import { QUERY_DEFAULT_OPTIONS } from '@/lib/query-defaults'
import { primeTenantIdCache } from '@/lib/tenant/get-tenant'

export function Providers({
  children,
  initialAuth,
}: {
  children: React.ReactNode
  initialAuth: DashboardAuthValue
}) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: QUERY_DEFAULT_OPTIONS }))

  // Când layout-ul are tenantul sesiunii (din antetul pus de proxy), îl dăm funcțiilor de query înainte de primele
  // interogări (efectele copiilor rulează după acest render), ca să nu-l mai caute nici măcar o dată.
  // Fără el (`tenantId: null`), `getTenantId` îl rezolvă singur, o singură dată pe sesiune.
  const tenantKey = `${initialAuth.userId ?? ''}:${initialAuth.tenantId ?? ''}`
  const [primedTenantKey, setPrimedTenantKey] = useState<string | null>(null)
  if (primedTenantKey !== tenantKey) {
    setPrimedTenantKey(tenantKey)
    primeTenantIdCache(initialAuth.userId, initialAuth.tenantId)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardAuthProvider value={initialAuth}>
        <AddActionProvider>
            <DensityProvider>
              <NotificationToastProvider />
              <RouteTransitionIndicator />
              <NavigationPerfLogger />
              <PageViewTracker />
              {children}
            </DensityProvider>
        </AddActionProvider>
      </DashboardAuthProvider>
    </QueryClientProvider>
  )
}
