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
import { primeTenantIdCache } from '@/lib/tenant/get-tenant'

export function Providers({
  children,
  initialAuth,
}: {
  children: React.ReactNode
  initialAuth: DashboardAuthValue
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            placeholderData: (previousData: unknown) => previousData,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
            retry: 1,
          },
        },
      })
  )

  // Serverul (proxy → layout) a rezolvat deja tenantul sesiunii: îl dăm funcțiilor de query înainte de primele
  // interogări (efectele copiilor rulează după acest render), ca să nu-l mai caute fiecare în parte.
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
