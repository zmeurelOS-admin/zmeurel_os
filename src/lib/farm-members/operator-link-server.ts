import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  firstAllowedRoute,
  resolveFarmMemberAccess,
  toStoredFarmMemberAccess,
  type FarmMemberModuleAccess,
} from '@/lib/farm-members/access'
import {
  evaluateOperatorLink,
  hiddenOperatorEmail,
  isHiddenOperatorEmail,
  OPERATOR_LINK_TTL_MS,
  ownerDisplayName,
  type OperatorLinkMember,
  type OperatorLinkRow,
  type OperatorLinkState,
} from '@/lib/farm-members/operator-link'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { farmDisplayName } from '@/lib/tenant/farm-display-name'
import type { Database } from '@/types/supabase'

type Admin = ReturnType<typeof getSupabaseAdmin>
// `farm_invites` / `farm_members` au coloane noi neincluse peste tot în tipuri; lucrăm netipat, ca restul modulului.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

function table(admin: Admin, name: 'farm_invites' | 'farm_members'): Loose {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return admin.from(name as any)
}

/** Coloana lipsește (migrarea `20261121200000` neaplicată). */
export function isMissingColumnError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false
  if (error.code === 'PGRST204' || error.code === '42703') return true
  const message = (error.message ?? '').toLowerCase()
  return message.includes('invitee_') && (message.includes('column') || message.includes('schema cache'))
}

export type LoadedOperatorLink = {
  row: OperatorLinkRow | null
  state: OperatorLinkState
  modules: FarmMemberModuleAccess[]
  member: OperatorLinkMember
}

export async function loadOperatorLink(token: string): Promise<LoadedOperatorLink> {
  const admin = getSupabaseAdmin()
  // `select('*')`: merge și fără coloanele noi `invitee_*`. Tokenul se compară exact.
  const { data, error } = await table(admin, 'farm_invites').select('*').eq('token', token).maybeSingle()
  const row = (error ? null : (data as OperatorLinkRow | null)) ?? null
  const modules = row ? resolveFarmMemberAccess(row.modules_access) : []

  let member: OperatorLinkMember = null
  if (row?.used_by_user_id && !row.used_at) {
    const { data: memberRow } = await table(admin, 'farm_members')
      .select('id, name, phone, is_active, role')
      .eq('tenant_id', row.tenant_id)
      .eq('user_id', row.used_by_user_id)
      .eq('role', 'operator')
      .order('is_active', { ascending: false })
      .limit(1)
      .maybeSingle()
    member = (memberRow as OperatorLinkMember) ?? null
  }

  return { row, state: evaluateOperatorLink({ row, hasModules: modules.length > 0, member }), modules, member }
}

/**
 * Marchează linkul folosit, atomic: un singur `update … where used_at is null` reușește,
 * deci două deschideri simultane nu pot crea două conturi.
 */
export async function claimOperatorLink(row: OperatorLinkRow, targetUserId: string | null): Promise<boolean> {
  const admin = getSupabaseAdmin()
  let query = table(admin, 'farm_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('token', row.token)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
  query = targetUserId ? query.eq('used_by_user_id', targetUserId) : query.is('used_by_user_id', null)
  const { data, error } = await query.select('id')
  return !error && Array.isArray(data) && data.length === 1
}

/** Prima invitație a picat înainte să existe contul: linkul redevine bun. */
export async function releaseOperatorLink(rowId: string): Promise<void> {
  const admin = getSupabaseAdmin()
  await table(admin, 'farm_invites').update({ used_at: null }).eq('id', rowId).is('used_by_user_id', null)
}

/**
 * Contul există, dar sesiunea n-a pornit: linkul devine unul de reconectare pentru același utilizator,
 * ca reîncercarea să nu creeze alt cont.
 */
export async function turnIntoReconnectLink(rowId: string, userId: string): Promise<void> {
  const admin = getSupabaseAdmin()
  await table(admin, 'farm_invites')
    .update({ used_at: null, used_by_user_id: userId, modules_access: [] })
    .eq('id', rowId)
}

/** Marchează cine a folosit prima invitație (după ce contul ascuns există). */
export async function markOperatorLinkUser(rowId: string, userId: string): Promise<void> {
  const admin = getSupabaseAdmin()
  await table(admin, 'farm_invites').update({ used_by_user_id: userId }).eq('id', rowId)
}

/** Utilizatorul ascuns: email intern nerutabil, confirmat, fără parolă. */
export async function createHiddenOperatorUser(name: string): Promise<{ id: string; email: string } | null> {
  const admin = getSupabaseAdmin()
  const email = hiddenOperatorEmail(crypto.randomUUID())
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name, invite_operator: true, link_only: true },
  })
  if (error || !data.user?.id) {
    console.error('[operator-link] createUser failed', { code: (error as { code?: string } | null)?.code ?? null })
    return null
  }
  return { id: data.user.id, email }
}

/** Șterge utilizatorul ascuns abia creat, când legarea de fermă a picat (fără date în urmă). */
export async function deleteFreshHiddenUser(userId: string): Promise<void> {
  const admin = getSupabaseAdmin()
  await removeAutoCreatedTenants(userId)
  await admin.auth.admin.deleteUser(userId).catch(() => undefined)
}

const CORE_TABLES = ['comenzi', 'recoltari', 'clienti', 'parcele'] as const

/**
 * Triggerul `on_auth_user_created` face o fermă pentru orice utilizator nou. Operatorul din link nu are fermă
 * proprie: ferma goală, proaspăt creată pentru el, se șterge (doar dacă e a lui și n-are date), iar profilul
 * lui rămâne fără tenant și în afara statisticilor (`exclude_from_analytics`).
 */
export async function removeAutoCreatedTenants(userId: string): Promise<void> {
  const admin = getSupabaseAdmin()
  await admin.from('profiles').upsert({ id: userId, tenant_id: null, exclude_from_analytics: true }, { onConflict: 'id' })

  const { data: tenants } = await admin.from('tenants').select('id, created_at').eq('owner_user_id', userId)
  for (const tenant of tenants ?? []) {
    const createdAt = new Date(tenant.created_at ?? 0).getTime()
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 60 * 60 * 1000) continue
    const counts = await Promise.all(
      CORE_TABLES.map(async (name) => {
        const { count, error } = await admin.from(name).select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id)
        return error ? 1 : (count ?? 0)
      }),
    )
    if (counts.some((count) => count > 0)) continue
    const { error } = await admin.from('tenants').delete().eq('id', tenant.id).eq('owner_user_id', userId)
    if (error) console.warn('[operator-link] auto tenant cleanup failed', { code: error.code })
  }
}

/** Leagă utilizatorul de fermă ca operator (`farm_members`), cu drepturile date. */
export async function linkUserToFarm(params: {
  tenantId: string
  userId: string
  name: string
  phone?: string | null
  modules: FarmMemberModuleAccess[]
  createdBy: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin()
  const { data: existing, error: existingError } = await table(admin, 'farm_members')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.userId)
    .eq('is_active', true)
    .maybeSingle()
  if (existingError) return { ok: false, error: 'member_lookup_failed' }

  if (existing) {
    const { error } = await table(admin, 'farm_members')
      .update({ role: 'operator', modules_access: toStoredFarmMemberAccess(params.modules), name: params.name })
      .eq('id', (existing as { id: string }).id)
    return error ? { ok: false, error: 'member_update_failed' } : { ok: true }
  }

  const { error } = await table(admin, 'farm_members').insert({
    tenant_id: params.tenantId,
    user_id: params.userId,
    role: 'operator',
    name: params.name,
    phone: params.phone?.trim() || null,
    modules_access: toStoredFarmMemberAccess(params.modules),
    is_active: true,
    created_by: params.createdBy,
  })
  return error ? { ok: false, error: 'member_insert_failed' } : { ok: true }
}

/** Primul modul permis pentru operatorul activ al fermei. */
export async function firstRouteForMember(tenantId: string, userId: string): Promise<string> {
  const admin = getSupabaseAdmin()
  const { data } = await table(admin, 'farm_members')
    .select('modules_access')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('role', 'operator')
    .maybeSingle()
  return firstAllowedRoute(resolveFarmMemberAccess((data as { modules_access?: unknown } | null)?.modules_access, { legacyFallback: true }))
}

/**
 * Hash-ul unei sesiuni noi pentru utilizator, fără parolă și fără email trimis: `generateLink` (admin) doar
 * întoarce linkul, nu-l trimite.
 */
async function magicLinkHash(email: string): Promise<string | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) {
    console.error('[operator-link] generateLink failed', { code: (error as { code?: string }).code ?? null })
    return null
  }
  return data.properties?.hashed_token ?? null
}

/** Pornește sesiunea pe clientul primit (cel de server scrie cookie-urile în răspuns). */
export async function startSessionWithoutPassword(supabase: SupabaseClient, email: string): Promise<boolean> {
  const tokenHash = await magicLinkHash(email)
  if (!tokenHash) return false
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (error) {
    console.error('[operator-link] verifyOtp failed', { code: (error as { code?: string }).code ?? null })
    return false
  }
  return true
}

/**
 * Închide toate sesiunile utilizatorului ascuns (de ex. telefonul pierdut): o sesiune nouă, ținută doar în memorie,
 * apoi `signOut({ scope: 'global' })`, care revocă toate sesiunile lui (inclusiv pe ea).
 */
export async function revokeAllSessions(email: string): Promise<boolean> {
  if (!isHiddenOperatorEmail(email)) return false
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return false
  const stateless = createSupabaseClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const started = await startSessionWithoutPassword(stateless as unknown as SupabaseClient, email)
  if (!started) return false
  const { error } = await stateless.auth.signOut({ scope: 'global' })
  return !error
}

/**
 * `true` dacă utilizatorul e operator activ și în ALTĂ fermă decât cea a linkului.
 *
 * Un operator din link ține de o singură fermă: cea care l-a invitat. Un link de reconectare îl pune pe cel care îl
 * deschide în contul acelui utilizator, iar contul lucrează în cea mai veche fermă în care e activ. Fără verificarea
 * asta, proprietarul unei alte ferme care ar reuși să scrie singur un rând în `farm_invites` (politica veche îi
 * dădea voie) ar intra în contul unui operator străin și, prin el, în ferma aceluia. La eroare răspunde `true`
 * (refuz), ca o citire picată să nu deschidă ușa.
 */
export async function hasActiveMembershipElsewhere(userId: string, tenantId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  const { data, error } = await table(admin, 'farm_members')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('tenant_id', tenantId)
    .limit(1)
  if (error) return true
  return Array.isArray(data) && data.length > 0
}

/** Link nou de reconectare pentru un operator din link; cele vechi, nefolosite, nu mai merg. */
export async function createReconnectLink(params: {
  tenantId: string
  userId: string
  createdBy: string
}): Promise<{ token: string; expiresAt: string } | null> {
  const admin = getSupabaseAdmin()
  const token = crypto.randomUUID()
  const nowIso = new Date().toISOString()
  const expiresAt = new Date(Date.now() + OPERATOR_LINK_TTL_MS).toISOString()

  const { error: oldError } = await table(admin, 'farm_invites')
    .update({ expires_at: nowIso })
    .eq('tenant_id', params.tenantId)
    .eq('used_by_user_id', params.userId)
    .is('used_at', null)
  if (oldError) return null

  const { error } = await table(admin, 'farm_invites').insert({
    tenant_id: params.tenantId,
    token,
    modules_access: [],
    created_by: params.createdBy,
    expires_at: expiresAt,
    used_by_user_id: params.userId,
  })
  return error ? null : { token, expiresAt }
}

export async function loadFarmName(tenantId: string): Promise<string> {
  const admin = getSupabaseAdmin()
  const { data } = await admin.from('tenants').select('nume_ferma').eq('id', tenantId).maybeSingle()
  return farmDisplayName(data?.nume_ferma) || 'Ferma'
}

/** Numele proprietarului fermei (din contul lui), pentru textele operatorului. */
export async function loadOwnerName(tenantId: string): Promise<string | null> {
  const admin = getSupabaseAdmin()
  const { data } = await admin.from('tenants').select('owner_user_id').eq('id', tenantId).maybeSingle()
  if (!data?.owner_user_id) return null
  const { data: owner } = await admin.auth.admin.getUserById(data.owner_user_id)
  return ownerDisplayName(owner?.user ?? null)
}

export async function getAuthUserEmail(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin()
  const { data } = await admin.auth.admin.getUserById(userId)
  return data?.user?.email ?? null
}
