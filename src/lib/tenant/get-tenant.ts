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

async function getOwnedTenantIdOrNull(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return tenant?.id ?? null
}

async function getOperatorTenantIdOrNull(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const farmMembersClient = supabase as SupabaseClient<Database> & {
    from(table: 'farm_members'): ReturnType<SupabaseClient<Database>['from']>
  }
  const { data: member, error } = await farmMembersClient
    .from('farm_members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('role', 'operator')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (member as { tenant_id?: string | null } | null)?.tenant_id ?? null
}

export async function getTenantIdByUserId(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string> {
  const tenantId = await getTenantIdByUserIdOrNull(supabase, userId)

  if (!tenantId) {
    throw new Error('Tenant indisponibil pentru utilizatorul curent.')
  }

  return tenantId
}

export async function getTenantIdByUserIdOrNull(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const operatorTenantId = await getOperatorTenantIdOrNull(supabase, userId)
  if (operatorTenantId) {
    return operatorTenantId
  }

  const ownedTenantId = await getOwnedTenantIdOrNull(supabase, userId)
  if (ownedTenantId) {
    return ownedTenantId
  }

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
