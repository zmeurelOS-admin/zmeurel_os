import type { SupabaseClient } from '@supabase/supabase-js'

import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'
import type { Database } from '@/types/supabase'

const DEFAULT_FARM_NAME = 'Ferma mea'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function normalizeFarmName(candidate: string | null | undefined) {
  const trimmed = (candidate ?? '').trim()
  if (trimmed.length < 2) return DEFAULT_FARM_NAME
  return trimmed.slice(0, 120)
}

async function waitForTenantId(
  supabase: SupabaseClient<Database>,
  userId: string,
  attempts = 5,
  delayMs = 200
): Promise<string | null> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const tenantId = await getTenantIdByUserIdOrNull(supabase, userId)
    if (tenantId) {
      return tenantId
    }

    if (attempt < attempts) {
      await delay(delayMs)
    }
  }

  return null
}

export async function ensureTenantForUser(params: {
  supabase: SupabaseClient<Database>
  userId: string
  fallbackFarmName?: string | null
  isDemo?: boolean
}) {
  const { supabase, userId, fallbackFarmName, isDemo = false } = params

  const existingTenantId = await waitForTenantId(supabase, userId)
  if (existingTenantId) {
    return existingTenantId
  }

  const admin = createServiceRoleClient()
  const farmName = normalizeFarmName(fallbackFarmName)

  const { error: profileUpsertError } = await admin.from('profiles').upsert(
    { id: userId },
    {
      onConflict: 'id',
      ignoreDuplicates: false,
    }
  )

  if (profileUpsertError) {
    throw new Error(profileUpsertError.message ?? 'Profile upsert failed')
  }

  const { data: existingTenant, error: existingTenantError } = await admin
    .from('tenants')
    .select('id')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existingTenantError) {
    throw new Error(existingTenantError.message ?? 'Tenant lookup failed')
  }

  let tenantId = existingTenant?.id ?? null

  if (!tenantId) {
    const demoFields = isDemo
      ? {
          is_demo: true,
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        }
      : {}

    const { data: createdTenant, error: createTenantError } = await admin
      .from('tenants')
      .insert({
        nume_ferma: farmName,
        owner_user_id: userId,
        ...demoFields,
      })
      .select('id')
      .single()

    if (createTenantError) {
      throw new Error(createTenantError.message ?? 'Tenant create failed')
    }

    tenantId = createdTenant.id
  }

  const { error: profileUpdateError } = await admin
    .from('profiles')
    .update({ tenant_id: tenantId })
    .eq('id', userId)

  if (profileUpdateError) {
    throw new Error(profileUpdateError.message ?? 'Profile tenant update failed')
  }

  return tenantId
}
