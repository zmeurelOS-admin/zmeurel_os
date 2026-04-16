import { config } from 'dotenv'

config({ path: '.env.local' })

import { getSupabaseAdmin } from '../src/lib/supabase/admin'

const PAGE_SIZE = 200
const PROTECTED_USER_IDS_ENV = 'CLEANUP_BETA_PROTECTED_USER_IDS'

type DeleteResult = 'ok' | 'missing_table' | 'error'

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return code === '42P01'
}

async function safeDeleteByTenant(
  admin: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  tenantId: string
): Promise<DeleteResult> {
  const { error } = await admin
    .from(table as never)
    .delete()
    .eq('tenant_id', tenantId)

  if (!error) return 'ok'
  if (isMissingTableError(error)) {
    console.log(`SKIP ${table}: table does not exist`)
    return 'missing_table'
  }

  console.error(`ERROR deleting ${table} for tenant ${tenantId}:`, error.message)
  return 'error'
}

async function deleteTenantData(admin: ReturnType<typeof getSupabaseAdmin>, tenantId: string) {
  const deletionOrder = [
    'activitati_agricole',
    'activitati_extra_season',
    'cheltuieli_diverse',
    'miscari_stoc',
    'vanzari_butasi_items',
    'vanzari_butasi',
    'vanzari',
    'recoltari',
    'comenzi',
    'culegatori',
    'clienti',
    'investitii',
    'alert_dismissals',
    'analytics_events',
    'nomenclatoare',
    'parcele',
  ] as const

  for (const table of deletionOrder) {
    const result = await safeDeleteByTenant(admin, table, tenantId)
    if (result === 'error') {
      throw new Error(`Failed deleting ${table} for tenant ${tenantId}`)
    }
  }
}

async function fetchAllAuthUsers(admin: ReturnType<typeof getSupabaseAdmin>) {
  const users: Array<{ id: string; email: string | null }> = []
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    })

    if (error) {
      throw new Error(`Failed to list auth users on page ${page}: ${error.message}`)
    }

    const pageUsers = (data?.users ?? []).map((u) => ({ id: u.id, email: u.email ?? null }))
    users.push(...pageUsers)

    if (pageUsers.length < PAGE_SIZE) break
    page += 1
  }

  return users
}

async function resolveTenantIdForUser(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from('tenants')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to resolve tenant for user ${userId}: ${error.message}`)
  }

  return data?.id ?? null
}

function parseCsvEnv(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

async function resolveProtectedUserIds(admin: ReturnType<typeof getSupabaseAdmin>): Promise<Set<string>> {
  const protectedIds = new Set(parseCsvEnv(process.env[PROTECTED_USER_IDS_ENV]))

  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('is_superadmin', true)

  if (error) {
    throw new Error(`Failed to load superadmin profiles: ${error.message}`)
  }

  for (const row of (data ?? []) as Array<{ id: string | null }>) {
    if (row.id) protectedIds.add(row.id.toLowerCase())
  }

  if (protectedIds.size === 0) {
    throw new Error(
      `No protected users resolved. Configure ${PROTECTED_USER_IDS_ENV} or ensure at least one superadmin profile exists.`,
    )
  }

  return protectedIds
}

async function deleteTenant(admin: ReturnType<typeof getSupabaseAdmin>, tenantId: string) {
  const { error } = await admin.from('tenants').delete().eq('id', tenantId)
  if (error) {
    throw new Error(`Failed deleting tenant ${tenantId}: ${error.message}`)
  }
}

async function deleteProfile(admin: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const { error } = await admin.from('profiles').delete().eq('id', userId)
  if (error) {
    throw new Error(`Failed deleting profile for ${userId}: ${error.message}`)
  }
}

async function deleteAuthUser(admin: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    throw new Error(`Failed deleting auth user ${userId}: ${error.message}`)
  }
}

async function main() {
  const admin = getSupabaseAdmin()

  let deletedUsers = 0
  let deletedTenants = 0
  let keptUsers = 0

  const protectedUserIds = await resolveProtectedUserIds(admin)
  const users = await fetchAllAuthUsers(admin)
  console.log(`Found ${users.length} auth users.`)

  for (const user of users) {
    const keepUser = protectedUserIds.has(user.id.toLowerCase())

    if (keepUser) {
      keptUsers += 1
      console.log(`KEEP ${user.id} (${user.email ?? 'no-email'})`)
      continue
    }

    console.log(`CLEAN ${user.id} (${user.email ?? 'no-email'})`)

    const tenantId = await resolveTenantIdForUser(admin, user.id)
    if (tenantId) {
      await deleteTenantData(admin, tenantId)
      await deleteTenant(admin, tenantId)
      deletedTenants += 1
    } else {
      console.log(`SKIP tenant cleanup for ${user.id}: no owner tenant found`)
    }

    await deleteProfile(admin, user.id)
    await deleteAuthUser(admin, user.id)
    deletedUsers += 1
  }

  console.log(
    `Deleted ${deletedUsers} users, ${deletedTenants} tenants, kept protected users: ${protectedUserIds.size}`
  )
  console.log(`Kept users count: ${keptUsers}`)

  const remainingUsers = await fetchAllAuthUsers(admin)
  const protectedUsers = remainingUsers.filter((user) => protectedUserIds.has(user.id.toLowerCase()))
  const remainingNonProtected = remainingUsers.filter((user) => !protectedUserIds.has(user.id.toLowerCase()))

  console.log(`Remaining users: ${remainingUsers.length}`)
  console.log(`Remaining protected admin users: ${protectedUsers.length}`)
  console.log(`Remaining non-protected users: ${remainingNonProtected.length}`)
}

main().catch((error) => {
  console.error('Cleanup failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
