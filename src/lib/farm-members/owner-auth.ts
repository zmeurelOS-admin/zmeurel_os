import { APP_URL, primaOrigineValida } from '@/lib/brand'
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

/** Originea linkurilor trimise pe WhatsApp: `SITE_URL`, apoi `NEXT_PUBLIC_SITE_URL`, altfel adresa platformei. */
function originLinkuri(): string {
  return primaOrigineValida([process.env.SITE_URL, process.env.NEXT_PUBLIC_SITE_URL]) ?? APP_URL
}

export function farmMemberInviteUrl(token: string): string {
  return `${originLinkuri()}/livrator/${encodeURIComponent(token)}`
}

export function farmOperatorInviteUrl(token: string): string {
  return `${originLinkuri()}/invite/${encodeURIComponent(token)}`
}
