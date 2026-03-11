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

export function createClient() {
  return getSupabase()
}

