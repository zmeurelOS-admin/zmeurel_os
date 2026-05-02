'use client'

import type { QueryClient } from '@tanstack/react-query'

import { resetSupabaseInstance } from '@/lib/supabase/client'

export interface PrepareSignOutOptions {
  /**
   * Cleanup pentru subscripția push a device-ului curent (de obicei
   * `usePushSubscription().unsubscribe`). Erorile sunt înghițite — logout-ul
   * nu trebuie blocat dacă cleanup-ul eșuează (offline, no PushManager, race).
   */
  unsubscribePush?: () => Promise<boolean>
}

/**
 * Acțiuni înainte de navigarea la POST /api/auth/sign-out (sau /api/auth/leave-demo).
 * Curăță subscripția push a device-ului curent, resetează singleton-ul Supabase
 * și golește cache-ul React Query înainte ca formul să fie submit-uit.
 */
export async function prepareClientBeforeServerSignOut(
  queryClient: QueryClient | null,
  options: PrepareSignOutOptions = {},
): Promise<void> {
  if (options.unsubscribePush) {
    try {
      await options.unsubscribePush()
    } catch (error) {
      console.warn('[sign-out] push unsubscribe failed; continuing sign-out', error)
    }
  }
  try {
    resetSupabaseInstance()
    if (queryClient) {
      void queryClient.cancelQueries()
      queryClient.clear()
    }
  } catch {
    /* noop */
  }
}
