import {
  firstAllowedRoute,
  normalizeFarmMemberAccess,
  type FarmMemberModuleAccess,
} from '@/lib/farm-members/access'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type FarmInviteValidation =
  | {
      valid: true
      invite: {
        id: string
        tenant_id: string
        token: string
        modules_access: FarmMemberModuleAccess[]
        created_by: string | null
        expires_at: string
        used_at: string | null
      }
    }
  | { valid: false; reason: 'not_found' | 'expired' | 'used' | 'no_modules' }

export async function validateFarmInviteToken(token: string): Promise<FarmInviteValidation> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_invites' as any)
    .select('id, tenant_id, token, modules_access, created_by, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) {
    return { valid: false, reason: 'not_found' }
  }

  const invite = data as unknown as {
    id: string
    tenant_id: string
    token: string
    modules_access: unknown
    created_by: string | null
    expires_at: string
    used_at: string | null
  }

  if (invite.used_at) {
    return { valid: false, reason: 'used' }
  }

  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return { valid: false, reason: 'expired' }
  }

  const modulesAccess = normalizeFarmMemberAccess(invite.modules_access)
  if (modulesAccess.length === 0) {
    return { valid: false, reason: 'no_modules' }
  }

  return {
    valid: true,
    invite: {
      ...invite,
      modules_access: modulesAccess,
    },
  }
}

export async function acceptFarmInviteForUser(params: {
  token: string
  userId: string
  name: string
}): Promise<{ ok: true; redirectTo: string } | { ok: false; error: string }> {
  const validation = await validateFarmInviteToken(params.token)
  if (!validation.valid) {
    return { ok: false, error: validation.reason }
  }

  const { invite } = validation
  const admin = getSupabaseAdmin()

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: params.userId, tenant_id: null }, { onConflict: 'id', ignoreDuplicates: true })

  if (profileError) {
    return { ok: false, error: 'profile_failed' }
  }

  const { data: existingMember, error: existingError } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .select('id')
    .eq('tenant_id', invite.tenant_id)
    .eq('user_id', params.userId)
    .eq('is_active', true)
    .maybeSingle()

  if (existingError) {
    return { ok: false, error: 'member_lookup_failed' }
  }

  if (existingMember) {
    const { error: updateMemberError } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('farm_members' as any)
      .update({
        role: 'operator',
        modules_access: invite.modules_access,
        name: params.name,
      })
      .eq('id', (existingMember as unknown as { id: string }).id)

    if (updateMemberError) {
      return { ok: false, error: 'member_update_failed' }
    }
  } else {
    const { error: memberInsertError } = await admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('farm_members' as any)
      .insert({
        tenant_id: invite.tenant_id,
        user_id: params.userId,
        role: 'operator',
        name: params.name,
        modules_access: invite.modules_access,
        is_active: true,
        created_by: invite.created_by,
      })

    if (memberInsertError) {
      return { ok: false, error: 'member_insert_failed' }
    }
  }

  const { error: inviteUpdateError } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_invites' as any)
    .update({
      used_at: new Date().toISOString(),
      used_by_user_id: params.userId,
    })
    .eq('id', invite.id)
    .is('used_at', null)

  if (inviteUpdateError) {
    return { ok: false, error: 'invite_update_failed' }
  }

  return {
    ok: true,
    redirectTo: firstAllowedRoute(invite.modules_access),
  }
}
