'use client'

import type { QueryClient } from '@tanstack/react-query'

import { resetSupabaseInstance } from '@/lib/supabase/client'

/** Acțiuni înainte de navigarea la POST /api/auth/sign-out (sesiune curățată pe server). */
export function prepareClientBeforeServerSignOut(queryClient: QueryClient | null): void {
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
