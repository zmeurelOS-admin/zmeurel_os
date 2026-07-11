import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

export async function ensureOwnerAccessToTenant(
  admin: SupabaseClient<Database>,
  tenantId: string,
  userId: string,
) {
  const { data, error } = await admin
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('owner_user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return Boolean(data?.id)
}
