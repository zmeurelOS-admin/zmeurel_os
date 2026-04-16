import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

const MISSING_ENV_MESSAGE =
  'RLS tests require env vars: SUPABASE_TEST_URL, ' +
  'SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY. ' +
  'Run: supabase start'

export function getTestEnv() {
  const url = process.env.SUPABASE_TEST_URL
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(MISSING_ENV_MESSAGE)
  }

  return { url, anonKey, serviceRoleKey }
}

export function createTestAdminClient() {
  const { url, serviceRoleKey } = getTestEnv()

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function createTestUserClient(email: string, password: string) {
  const { url, anonKey } = getTestEnv()

  const client = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(`Failed to sign in test user ${email}: ${error.message}`)
  }

  return client
}
