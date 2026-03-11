import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

function buildServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase admin environment variables are missing')
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function createServiceRoleClient() {
  return buildServiceRoleClient()
}

export function getSupabaseAdmin() {
  return buildServiceRoleClient()
}
