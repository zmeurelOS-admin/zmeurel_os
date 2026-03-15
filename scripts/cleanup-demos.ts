/**
 * cleanup-demos.ts
 * Deletes all demo / guest tenant accounts while protecting the main admin.
 *
 * Safety rules:
 *  1. Aborts if popa.andrei.sv@gmail.com is NOT found in auth.
 *  2. Never touches Andrei's tenant or auth user.
 *  3. Targets only demo-style accounts (guest-*, @demo.zmeurel.local, obviously-test emails).
 *
 * Run: npx tsx scripts/cleanup-demos.ts [--dry-run]
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { getSupabaseAdmin } from '../src/lib/supabase/admin'

const PROTECTED_EMAIL = 'popa.andrei.sv@gmail.com'
const PAGE_SIZE = 200
const DRY_RUN = process.argv.includes('--dry-run')

function isDemoEmail(email: string | null): boolean {
  if (!email) return true
  const e = email.toLowerCase()
  return (
    e.endsWith('@demo.zmeurel.local') ||
    e.startsWith('guest-') ||
    e.startsWith('guest+') ||
    e === 'asd@asd.com' ||
    e.match(/^test[-+@]/) !== null ||
    e.match(/^demo[-+@]/) !== null ||
    e.match(/^\d+@/) !== null
  )
}

async function fetchAllAuthUsers(admin: ReturnType<typeof getSupabaseAdmin>) {
  const users: Array<{ id: string; email: string | null }> = []
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`)
    const batch = (data?.users ?? []).map((u) => ({ id: u.id, email: u.email ?? null }))
    users.push(...batch)
    if (batch.length < PAGE_SIZE) break
    page++
  }
  return users
}

async function deleteTenantData(admin: ReturnType<typeof getSupabaseAdmin>, tenantId: string) {
  const tables = [
    'activitati_agricole', 'activitati_extra_season', 'cheltuieli_diverse',
    'miscari_stoc', 'vanzari_butasi_items', 'vanzari_butasi', 'vanzari',
    'recoltari', 'comenzi', 'culegatori', 'clienti', 'investitii',
    'alert_dismissals', 'analytics_events', 'nomenclatoare', 'parcele',
  ] as const

  for (const table of tables) {
    const { error } = await admin.from(table as never).delete().eq('tenant_id', tenantId)
    if (error && error.code !== '42P01') {
      throw new Error(`Error deleting ${table} for tenant ${tenantId}: ${error.message}`)
    }
  }
}

async function main() {
  const admin = getSupabaseAdmin()
  if (DRY_RUN) console.log('DRY RUN — no changes will be made\n')

  const users = await fetchAllAuthUsers(admin)
  console.log(`Found ${users.length} auth users.`)

  // Safety check: Andrei must exist
  const andrei = users.find((u) => u.email?.toLowerCase() === PROTECTED_EMAIL.toLowerCase())
  if (!andrei) {
    console.error(`ABORT: Protected admin account (${PROTECTED_EMAIL}) not found in auth. Refusing to run.`)
    process.exit(1)
  }
  console.log(`Protected admin found: ${andrei.id} (${andrei.email})\n`)

  const targets = users.filter((u) => u.id !== andrei.id && isDemoEmail(u.email))
  const skipped = users.filter((u) => u.id !== andrei.id && !isDemoEmail(u.email))

  if (skipped.length > 0) {
    console.log(`Skipping ${skipped.length} non-demo real user(s):`)
    for (const u of skipped) console.log(`  SKIP ${u.id} (${u.email ?? 'no-email'})`)
    console.log()
  }

  console.log(`Targeting ${targets.length} demo account(s) for deletion.`)

  let deletedUsers = 0
  let deletedTenants = 0

  for (const user of targets) {
    console.log(`→ ${user.id} (${user.email ?? 'no-email'})`)

    if (DRY_RUN) {
      console.log('  [dry-run] would delete tenant data + tenant + profile + auth user')
      continue
    }

    // Resolve tenant
    const { data: tenantData } = await admin
      .from('tenants')
      .select('id')
      .eq('owner_user_id', user.id)
      .maybeSingle()

    if (tenantData?.id) {
      await deleteTenantData(admin, tenantData.id)
      const { error: tErr } = await admin.from('tenants').delete().eq('id', tenantData.id)
      if (tErr) throw new Error(`Failed deleting tenant ${tenantData.id}: ${tErr.message}`)
      deletedTenants++
    }

    const { error: pErr } = await admin.from('profiles').delete().eq('id', user.id)
    if (pErr) console.warn(`  WARN: profile delete: ${pErr.message}`)

    const { error: aErr } = await admin.auth.admin.deleteUser(user.id)
    if (aErr) throw new Error(`Failed deleting auth user ${user.id}: ${aErr.message}`)

    deletedUsers++
  }

  if (DRY_RUN) {
    console.log(`\nDry-run complete. Would have deleted ${targets.length} demo user(s).`)
  } else {
    console.log(`\nDone. Deleted ${deletedUsers} user(s), ${deletedTenants} tenant(s).`)
  }
}

main().catch((err) => {
  console.error('cleanup-demos failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
