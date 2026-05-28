import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'

export type FarmOwnerContext = {
  userId: string
  tenantId: string
}

export async function getFarmOwnerContext(): Promise<FarmOwnerContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.id) {
    return null
  }

  let tenantId: string
  try {
    tenantId = await getTenantIdByUserId(supabase, user.id)
  } catch {
    return null
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (error || !data?.id) {
    return null
  }

  return {
    userId: user.id,
    tenantId,
  }
}

export function farmMemberInviteUrl(token: string): string {
  return `https://zmeurel.ro/livrator/${encodeURIComponent(token)}`
}
