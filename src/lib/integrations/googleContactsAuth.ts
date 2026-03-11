import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { getTenantId } from '@/lib/tenant/get-tenant'

export interface AdminAuthContext {
  supabase: SupabaseClient<Database>
  userId: string
  userEmail: string
  tenantId: string
}

export async function requireGoogleContactsAdmin(): Promise<AdminAuthContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id || !user.email) {
    throw new Error('FORBIDDEN')
  }

  const superadmin = await isSuperAdmin(supabase, user.id)
  if (!superadmin) {
    throw new Error('FORBIDDEN')
  }

  let tenantId: string
  try {
    tenantId = await getTenantId(supabase)
  } catch {
    throw new Error('TENANT_NOT_FOUND')
  }

  return {
    supabase,
    userId: user.id,
    userEmail: user.email.toLowerCase(),
    tenantId,
  }
}
