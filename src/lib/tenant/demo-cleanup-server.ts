/**
 * Curățarea demo-urilor: citirea din bază, reverificarea unei ferme și ștergerea ei.
 * Regulile (ce fermă intră, ce e semn de fermă reală) sunt în `demo-cleanup.ts`.
 *
 * Ordinea ștergerii unei ferme: fișierele din `bonuri/{tenant_id}/` → datele → rândul din `tenants` → utilizatorul din `auth`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { BONURI_BUCKET } from '@/lib/bonuri'
import {
  deleteTenantScopedData,
  TENANT_DESTRUCTIVE_CLEANUP_SCOPES,
} from '@/lib/tenant/destructive-cleanup'
import type { Database } from '@/types/supabase'

import {
  esteCaleBonAFermei,
  esteTenantIdValid,
  type DemoDeSters,
  type StareFermaDemo,
  type TenantPentruCuratare,
} from './demo-cleanup'

type Admin = SupabaseClient<Database>

/**
 * Tabele care se șterg DOAR pentru un demo, înaintea listei comune `TENANT_SCOPED_DELETE_ORDER`
 * (folosită și de resetarea fermei și de ștergerea GDPR, unde nu le schimbăm comportamentul).
 *
 * - Lanțul de tratamente și capcane are chei `ON DELETE RESTRICT` spre `parcele`, `produse_fitosanitare` și
 *   `planuri_tratament`. Lista comună șterge `parcele` explicit, așa că rândurile copil trebuie să plece înainte,
 *   copil → părinte. (Toate au și `tenant_id ... ON DELETE CASCADE`, dar RESTRICT se verifică imediat.)
 * - `ai_usage_log.tenant_id` (și `user_id`) n-are cascadă: ar bloca ștergerea fermei și a utilizatorului.
 */
export const DEMO_ONLY_DELETE_ORDER = [
  'aplicari_tratament_produse',
  'capcane_verificari',
  'capcane_montate',
  'aplicari_tratament',
  'parcele_planuri',
  'planuri_tratament_linie_produse',
  'planuri_tratament_linii',
  'planuri_tratament',
  'produse_fitosanitare',
  'ai_usage_log',
] as const

const PAGINA_UTILIZATORI = 1000
const PAGINA_RANDURI = 1000
const PAGINA_FISIERE = 1000
const LOT_STERGERE_FISIERE = 100
const ADANCIME_MAXIMA_BONURI = 4

/** Emailurile tuturor utilizatorilor (id → email). */
export async function citesteEmailuri(admin: Admin): Promise<Map<string, string>> {
  const emails = new Map<string, string>()
  for (let page = 1; page < 1000; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGINA_UTILIZATORI })
    if (error) throw error
    const users = data?.users ?? []
    for (const user of users) {
      if (user.email) emails.set(user.id, user.email)
    }
    if (users.length < PAGINA_UTILIZATORI) break
  }
  return emails
}

/** Toate fermele (în pagini, limita PostgREST e 1000). */
export async function citesteTenanti(admin: Admin): Promise<TenantPentruCuratare[]> {
  const rows: TenantPentruCuratare[] = []
  for (let de = 0; ; de += PAGINA_RANDURI) {
    const { data, error } = await admin
      .from('tenants')
      .select('id, owner_user_id, created_at, is_demo, is_association_approved')
      .order('id', { ascending: true })
      .range(de, de + PAGINA_RANDURI - 1)
    if (error) throw error
    const bucata = (data ?? []) as TenantPentruCuratare[]
    rows.push(...bucata)
    if (bucata.length < PAGINA_RANDURI) break
  }
  return rows
}

/** Superadminii și membrii asociației. Dacă nu le putem citi, aruncă (nu ștergem nimic fără protecții). */
export async function citesteProtectii(
  admin: Admin,
): Promise<{ superadminIds: Set<string>; associationMemberIds: Set<string> }> {
  const [superadmins, members] = await Promise.all([
    admin.from('profiles').select('id').eq('is_superadmin', true),
    admin.from('association_members').select('user_id'),
  ])
  if (superadmins.error) throw new Error(`Fetch superadmins: ${superadmins.error.message}`)
  if (members.error) throw new Error(`Fetch association_members: ${members.error.message}`)
  const ids = (rows: Array<Record<string, unknown>> | null, key: string) =>
    new Set(
      (rows ?? [])
        .map((row) => row[key])
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    )
  return {
    superadminIds: ids(superadmins.data as Array<Record<string, unknown>> | null, 'id'),
    associationMemberIds: ids(members.data as Array<Record<string, unknown>> | null, 'user_id'),
  }
}

// ─── Bonurile ──────────────────────────────────────────────────────────────────

/** Toate fișierele din `bonuri/{tenant_id}/…`. Un `tenant_id` invalid = nicio cale. */
export async function listeazaBonuri(admin: Admin, tenantId: string): Promise<string[]> {
  if (!esteTenantIdValid(tenantId)) return []
  const bucket = admin.storage.from(BONURI_BUCKET)
  const paths: string[] = []

  async function parcurge(prefix: string, adancime: number): Promise<void> {
    if (adancime > ADANCIME_MAXIMA_BONURI) return
    for (let offset = 0; ; offset += PAGINA_FISIERE) {
      const { data, error } = await bucket.list(prefix, { limit: PAGINA_FISIERE, offset })
      if (error) throw error
      const entries = data ?? []
      for (const entry of entries) {
        if (!entry?.name) continue
        const path = `${prefix}/${entry.name}`
        // Un dosar apare fără `id`; un fișier are `id`.
        if (entry.id === null || entry.id === undefined) await parcurge(path, adancime + 1)
        else paths.push(path)
      }
      if (entries.length < PAGINA_FISIERE) break
    }
  }

  await parcurge(tenantId, 1)
  return paths.filter((path) => esteCaleBonAFermei(tenantId, path))
}

/** Șterge bonurile fermei și verifică apoi că prefixul e gol. Aruncă dacă rămâne ceva. */
async function stergeBonuri(admin: Admin, tenantId: string): Promise<number> {
  if (!esteTenantIdValid(tenantId)) throw new Error('tenant_id invalid pentru bonuri')
  const paths = await listeazaBonuri(admin, tenantId)
  for (const path of paths) {
    if (!esteCaleBonAFermei(tenantId, path)) throw new Error(`Cale bon în afara fermei: ${path}`)
  }
  for (let i = 0; i < paths.length; i += LOT_STERGERE_FISIERE) {
    const lot = paths.slice(i, i + LOT_STERGERE_FISIERE)
    const { error } = await admin.storage.from(BONURI_BUCKET).remove(lot)
    if (error) throw error
  }
  if (paths.length > 0) {
    const ramase = await listeazaBonuri(admin, tenantId)
    if (ramase.length > 0) throw new Error(`Au rămas ${ramase.length} bonuri după ștergere`)
  }
  return paths.length
}

// ─── Reverificarea ─────────────────────────────────────────────────────────────

async function numara(
  query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  ce: string,
): Promise<number> {
  const { data, error } = await query
  if (error) throw new Error(`Verificare ${ce}: ${error.message}`)
  return (data ?? []).length
}

/** Citește acum starea fermei și a proprietarului ei (doar `select` și `getUserById`). */
export async function citesteStareaFermei(
  admin: Admin,
  candidat: DemoDeSters,
  esteProprietarProtejat: (userId: string) => boolean,
): Promise<StareFermaDemo> {
  const { tenantId, ownerUserId } = candidat

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('owner_user_id, created_at, is_association_approved')
    .eq('id', tenantId)
    .maybeSingle()
  if (tenantError) throw new Error(`Verificare tenants: ${tenantError.message}`)

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(ownerUserId)
  if (userError) throw new Error(`Verificare auth: ${userError.message}`)

  const { data: ownerProfile, error: ownerProfileError } = await admin
    .from('profiles')
    .select('is_superadmin')
    .eq('id', ownerUserId)
    .maybeSingle()
  if (ownerProfileError) throw new Error(`Verificare profiles: ${ownerProfileError.message}`)

  const { data: profileRows, error: profilesError } = await admin.from('profiles').select('id').eq('tenant_id', tenantId)
  if (profilesError) throw new Error(`Verificare profiles: ${profilesError.message}`)

  const { data: memberRows, error: membersError } = await admin
    .from('farm_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
  if (membersError) throw new Error(`Verificare farm_members: ${membersError.message}`)

  const [ownerInAsociatie, fermeAleProprietarului, comenziMagazin, legaturiMagazin, oferteAsociatie] = await Promise.all([
    numara(admin.from('association_members').select('user_id').eq('user_id', ownerUserId).limit(1), 'association_members'),
    numara(admin.from('tenants').select('id').eq('owner_user_id', ownerUserId), 'tenants'),
    numara(admin.from('shop_orders').select('id').eq('tenant_id', tenantId).limit(1), 'shop_orders'),
    numara(admin.from('shop_order_erp_links').select('id').eq('tenant_id', tenantId).limit(1), 'shop_order_erp_links'),
    numara(
      admin.from('association_product_offers').select('id').eq('tenant_id', tenantId).limit(1),
      'association_product_offers',
    ),
  ])

  return {
    tenant: tenant
      ? {
          owner_user_id: tenant.owner_user_id ?? null,
          created_at: tenant.created_at ?? null,
          is_association_approved: tenant.is_association_approved ?? null,
        }
      : null,
    ownerEmail: userData?.user?.email ?? null,
    ownerSuperadmin: (ownerProfile as { is_superadmin?: boolean | null } | null)?.is_superadmin === true,
    ownerProtejat: esteProprietarProtejat(ownerUserId),
    ownerInAsociatie: ownerInAsociatie > 0,
    fermeAleProprietarului,
    profileIds: ((profileRows ?? []) as Array<{ id: string }>).map((row) => row.id),
    membriUserIds: ((memberRows ?? []) as Array<{ user_id: string | null }>).map((row) => row.user_id ?? null),
    comenziMagazin,
    legaturiMagazin,
    oferteAsociatie,
  }
}

// ─── Ștergerea ─────────────────────────────────────────────────────────────────

export type RezultatStergereDemo = {
  fisiere: number
  utilizatorSters: boolean
  avertismente: string[]
}

async function stergeDupa(admin: Admin, table: (typeof DEMO_ONLY_DELETE_ORDER)[number], coloana: string, valoare: string) {
  const { error } = await admin.from(table).delete().eq(coloana as never, valoare as never)
  if (error) throw new Error(`Delete ${table}: ${error.message}`)
}

/**
 * Șterge un demo deja reverificat. Aruncă la prima problemă (ferma rămâne pentru noaptea următoare);
 * ce s-a șters până atunci rămâne șters, dar rândul din `tenants` și utilizatorul pleacă doar la final.
 */
export async function stergeFermaDemo(admin: Admin, candidat: DemoDeSters): Promise<RezultatStergereDemo> {
  const { tenantId, ownerUserId } = candidat
  if (!esteTenantIdValid(tenantId)) throw new Error('tenant_id invalid')
  const avertismente: string[] = []

  // 1. Fișierele, doar sub prefixul fermei.
  const fisiere = await stergeBonuri(admin, tenantId)

  // 2. Datele: întâi tabelele doar-demo (RESTRICT), apoi lista comună (cu verificarea tabelelor critice).
  for (const table of DEMO_ONLY_DELETE_ORDER) {
    await stergeDupa(admin, table, 'tenant_id', tenantId)
  }
  const cleanup = await deleteTenantScopedData(admin, tenantId, {
    scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.demoTenantCleanup,
    verifyCriticalTables: true,
  })
  const nonCritical = cleanup.steps.filter((step) => step.status === 'failed' && !step.critical)
  if (nonCritical.length > 0) {
    avertismente.push(`tabele necritice neșterse: ${nonCritical.map((step) => step.target).join(', ')}`)
  }
  // `ai_usage_log.user_id` n-are cascadă spre `auth.users`.
  await stergeDupa(admin, 'ai_usage_log', 'user_id', ownerUserId)

  // 3. Rândul din `tenants` (restul tabelelor cu `tenant_id` pleacă în cascadă), doar dacă e tot al acestui proprietar.
  const { error: tenantError } = await admin
    .from('tenants')
    .delete()
    .eq('id', tenantId)
    .eq('owner_user_id', ownerUserId)
  if (tenantError) throw new Error(`Delete tenants: ${tenantError.message}`)

  // 4. Utilizatorul din `auth` (în cascadă: profiles, notifications, push_subscriptions, notificari_preferinte, feedback…).
  const { error: authError } = await admin.auth.admin.deleteUser(ownerUserId)
  if (authError) {
    avertismente.push(`utilizatorul n-a putut fi șters: ${authError.message}`)
    return { fisiere, utilizatorSters: false, avertismente }
  }

  return { fisiere, utilizatorSters: true, avertismente }
}
