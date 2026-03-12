import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

type TenantSummary = Pick<Database['public']['Tables']['tenants']['Row'], 'id' | 'nume_ferma'>

async function getProfileTenantRow(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ tenant_id: string | null } | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  return profile
}

export async function getTenantIdByUserId(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string> {
  const profile = await getProfileTenantRow(supabase, userId)

  if (!profile?.tenant_id) {
    throw new Error('Tenant indisponibil pentru utilizatorul curent.')
  }

  return profile.tenant_id
}

export async function getTenantIdByUserIdOrNull(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const profile = await getProfileTenantRow(supabase, userId)
  return profile?.tenant_id ?? null
}

export async function getTenantByIdOrNull(
  supabase: SupabaseClient<Database>,
  tenantId: string | null
): Promise<TenantSummary | null> {
  if (!tenantId) {
    return null
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id,nume_ferma')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantError) {
    throw tenantError
  }

  return tenant
}

export async function getTenantByUserIdOrNull(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<TenantSummary | null> {
  const tenantId = await getTenantIdByUserIdOrNull(supabase, userId)
  return getTenantByIdOrNull(supabase, tenantId)
}

export async function getTenantId(supabase: SupabaseClient<Database>): Promise<string> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.id) {
    throw new Error('Neautorizat')
  }

  return getTenantIdByUserId(supabase, user.id)
}

export async function getTenantIdOrNull(supabase: SupabaseClient<Database>): Promise<string | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.id) {
    return null
  }

  return getTenantIdByUserIdOrNull(supabase, user.id)
}
