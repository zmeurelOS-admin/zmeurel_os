/**
 * Utilitare E2E pentru curățare utilizatori Auth + tenant (doar teste).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export function createServiceRoleClient(): SupabaseClient {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

export function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { sub?: string }
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

export async function findAuthUserIdByEmail(service: SupabaseClient, email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase()
  let page = 1
  const perPage = 1000
  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const hit = data.users.find((u) => u.email?.toLowerCase() === needle)
    if (hit?.id) return hit.id
    if (data.users.length < perPage) break
    page += 1
  }
  return null
}

export async function deleteAuthUserAndTenant(service: SupabaseClient, userId: string): Promise<void> {
  const { data: profile } = await service.from('profiles').select('tenant_id').eq('id', userId).maybeSingle()
  if (profile?.tenant_id) {
    const { error: dErr } = await service.from('tenants').delete().eq('id', profile.tenant_id)
    if (dErr) throw new Error(`delete tenant: ${dErr.message}`)
  }
  const { error: uErr } = await service.auth.admin.deleteUser(userId)
  if (uErr) throw new Error(`deleteUser: ${uErr.message}`)
}

export async function deleteAuthUserByEmail(service: SupabaseClient, email: string): Promise<void> {
  const id = await findAuthUserIdByEmail(service, email)
  if (!id) return
  await deleteAuthUserAndTenant(service, id)
}

export async function deleteAuthUserBestEffort(service: SupabaseClient, userId: string): Promise<void> {
  try {
    await deleteAuthUserAndTenant(service, userId)
  } catch {
    /* FK demo / ordine cleanup */
  }
}
