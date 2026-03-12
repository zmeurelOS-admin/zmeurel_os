import { config } from 'dotenv'

config({ path: '.env.local' })

import { getSupabaseAdmin } from '../src/lib/supabase/admin'

const PROTECTED_ADMIN_EMAIL = 'popa.andrei.sv@gmail.com'
const PAGE_SIZE = 200
const REQUIRE_CONFIRM_FLAG = '--confirm'

const TENANT_TABLES_IN_DELETE_ORDER = [
  'vanzari_butasi_items',
  'vanzari_butasi',
  'miscari_stoc',
  'alert_dismissals',
  'integrations_google_contacts',
  'analytics_events',
  'vanzari',
  'comenzi',
  'recoltari',
  'cheltuieli_diverse',
  'activitati_agricole',
  'activitati_extra_season',
  'investitii',
  'clienti',
  'culegatori',
  'nomenclatoare',
  'parcele',
] as const

type TenantTable = (typeof TENANT_TABLES_IN_DELETE_ORDER)[number]

type AuthUserLite = {
  id: string
  email: string | null
}

type OwnedTenant = {
  id: string
  owner_user_id: string | null
}

type TableDeletionSummary = Record<TenantTable, number>

type CleanupSummary = {
  protectedEmail: string
  keptUsers: number
  deletedUsers: number
  deletedProfiles: number
  deletedTenants: number
  deletedTenantRows: TableDeletionSummary
}

function initTableSummary(): TableDeletionSummary {
  return {
    vanzari_butasi_items: 0,
    vanzari_butasi: 0,
    miscari_stoc: 0,
    alert_dismissals: 0,
    integrations_google_contacts: 0,
    analytics_events: 0,
    vanzari: 0,
    comenzi: 0,
    recoltari: 0,
    cheltuieli_diverse: 0,
    activitati_agricole: 0,
    activitati_extra_season: 0,
    investitii: 0,
    clienti: 0,
    culegatori: 0,
    nomenclatoare: 0,
    parcele: 0,
  }
}

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01' || code === 'PGRST205'
}

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

function isProtectedEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === PROTECTED_ADMIN_EMAIL
}

async function listAllAuthUsers(): Promise<AuthUserLite[]> {
  const admin = getSupabaseAdmin()
  const users: AuthUserLite[] = []
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    })

    if (error) {
      throw new Error(`Failed to list auth users (page ${page}): ${error.message}`)
    }

    const pageUsers = (data?.users ?? []).map((item) => ({
      id: item.id,
      email: item.email ?? null,
    }))

    users.push(...pageUsers)
    if (pageUsers.length < PAGE_SIZE) break
    page += 1
  }

  return users
}

async function getOwnedTenants(ownerUserId: string): Promise<OwnedTenant[]> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('tenants')
    .select('id,owner_user_id')
    .eq('owner_user_id', ownerUserId)

  if (error) {
    throw new Error(`Failed to read tenants for user ${ownerUserId}: ${error.message}`)
  }

  return (data ?? []) as OwnedTenant[]
}

async function countRowsForTenant(table: TenantTable, tenantId: string): Promise<number> {
  const admin = getSupabaseAdmin()
  const { count, error } = await (admin as any)
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(`Failed counting ${table} for tenant ${tenantId}: ${error.message}`)
  }

  return count ?? 0
}

async function deleteRowsForTenant(table: TenantTable, tenantId: string): Promise<void> {
  const admin = getSupabaseAdmin()
  const { error } = await (admin as any).from(table).delete().eq('tenant_id', tenantId)

  if (error && !isMissingTableError(error)) {
    throw new Error(`Failed deleting ${table} for tenant ${tenantId}: ${error.message}`)
  }
}

async function deleteTenantById(tenantId: string): Promise<void> {
  const admin = getSupabaseAdmin()
  const { error } = await admin.from('tenants').delete().eq('id', tenantId)
  if (error) {
    throw new Error(`Failed deleting tenant ${tenantId}: ${error.message}`)
  }
}

async function deleteProfileByUserId(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  const { error, count } = await admin
    .from('profiles')
    .delete({ count: 'exact' })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed deleting profile for ${userId}: ${error.message}`)
  }

  return (count ?? 0) > 0
}

async function deleteAuthUserById(userId: string): Promise<void> {
  const admin = getSupabaseAdmin()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    throw new Error(`Failed deleting auth user ${userId}: ${error.message}`)
  }
}

async function deleteTenantScopedData(
  tenantId: string,
  aggregate: TableDeletionSummary
): Promise<void> {
  for (const table of TENANT_TABLES_IN_DELETE_ORDER) {
    const rows = await countRowsForTenant(table, tenantId)
    if (rows === 0) {
      continue
    }

    await deleteRowsForTenant(table, tenantId)
    aggregate[table] += rows
    console.log(`Deleted ${rows} row(s) from ${table} for tenant ${tenantId}`)
  }
}

async function runCleanup(performDelete: boolean): Promise<CleanupSummary> {
  const users = await listAllAuthUsers()
  const protectedUsers = users.filter((user) => isProtectedEmail(user.email))
  const deletableUsers = users.filter((user) => !isProtectedEmail(user.email))

  if (protectedUsers.length === 0) {
    throw new Error(`Protected admin account not found: ${PROTECTED_ADMIN_EMAIL}`)
  }

  const summary: CleanupSummary = {
    protectedEmail: PROTECTED_ADMIN_EMAIL,
    keptUsers: protectedUsers.length,
    deletedUsers: 0,
    deletedProfiles: 0,
    deletedTenants: 0,
    deletedTenantRows: initTableSummary(),
  }

  console.log(`Found ${users.length} auth user(s).`)
  console.log(`Protected admin user(s): ${protectedUsers.length}`)
  console.log(`Candidate users for deletion: ${deletableUsers.length}`)
  console.log(`Mode: ${performDelete ? 'DELETE' : 'DRY RUN'}`)

  for (const user of protectedUsers) {
    console.log(`KEEP user ${user.id} (${user.email ?? 'no-email'})`)
  }

  for (const user of deletableUsers) {
    const userEmail = user.email ?? 'no-email'
    const ownedTenants = await getOwnedTenants(user.id)
    console.log(`\nUSER ${user.id} (${userEmail}) -> owned tenants: ${ownedTenants.length}`)

    for (const tenant of ownedTenants) {
      if (performDelete) {
        await deleteTenantScopedData(tenant.id, summary.deletedTenantRows)
        await deleteTenantById(tenant.id)
      }
      summary.deletedTenants += 1
      console.log(`${performDelete ? 'DELETED' : 'WOULD DELETE'} tenant ${tenant.id}`)
    }

    if (performDelete) {
      const profileDeleted = await deleteProfileByUserId(user.id)
      if (profileDeleted) {
        summary.deletedProfiles += 1
      }
      await deleteAuthUserById(user.id)
    }

    summary.deletedUsers += 1
    console.log(`${performDelete ? 'DELETED' : 'WOULD DELETE'} user ${user.id}`)
  }

  return summary
}

async function main() {
  const confirmed = process.argv.includes(REQUIRE_CONFIRM_FLAG)

  if (!confirmed) {
    console.log(`Safety check: run with ${REQUIRE_CONFIRM_FLAG} to execute deletions.`)
    const dryRunSummary = await runCleanup(false)
    console.log('\nDry run summary:')
    console.log(JSON.stringify(dryRunSummary, null, 2))
    return
  }

  const summary = await runCleanup(true)

  const remainingUsers = await listAllAuthUsers()
  const remainingProtected = remainingUsers.filter((user) => isProtectedEmail(user.email))
  const remainingNonProtected = remainingUsers.filter((user) => !isProtectedEmail(user.email))

  console.log('\nDeletion summary:')
  console.log(JSON.stringify(summary, null, 2))
  console.log('\nPost-cleanup verification:')
  console.log(`Remaining auth users: ${remainingUsers.length}`)
  console.log(`Remaining protected users: ${remainingProtected.length}`)
  console.log(`Remaining non-protected users: ${remainingNonProtected.length}`)
}

main().catch((error) => {
  console.error('reset-test-users failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
