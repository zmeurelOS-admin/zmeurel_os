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
import { AddActionProvider } from '@/contexts/AddActionContext'

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

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardAuthProvider value={initialAuth}>
        <AddActionProvider>
            <DensityProvider>
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
