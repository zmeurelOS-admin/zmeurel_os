import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      }
    )
  }

  return supabaseInstance
}

/**
 * Resets the singleton browser Supabase client.
 * Call after signOut so the next login creates a fresh instance
 * without stale Navigator LockManager lock state.
 */
export function resetSupabaseInstance() {
  supabaseInstance = null
}

export function createClient() {
  return getSupabase()
}

