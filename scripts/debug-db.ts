/**
 * debug-db.ts
 * Connects with the service role key and prints a diagnostic report:
 *   - target auth user + tenant
 *   - Parcele for that tenant (columns + count)
 *   - Whether the `stadiu` column exists
 *   - Attempts a dry test-insert/delete to verify write access
 *
 * Run: npx tsx scripts/debug-db.ts
 *
 * Target selection:
 *   1. `DEBUG_DB_TARGET_USER_ID` (recommended)
 *   2. First `profiles.is_superadmin = true` user (fallback)
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { getSupabaseAdmin } from '../src/lib/supabase/admin'

function parseEnvCsv(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

async function resolveTargetUserId(admin: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  const explicit = parseEnvCsv(process.env.DEBUG_DB_TARGET_USER_ID)[0]
  if (explicit) return explicit

  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('is_superadmin', true)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`profiles lookup failed: ${error.message}`)
  }

  if (!data?.id) {
    throw new Error(
      'No debug target found. Set DEBUG_DB_TARGET_USER_ID or ensure at least one superadmin profile exists.',
    )
  }

  return data.id
}

async function main() {
  const admin = getSupabaseAdmin()

  // 1. Resolve target auth user
  console.log('=== Auth user ===')
  const targetUserId = await resolveTargetUserId(admin)
  const { data: authUser, error: authUserErr } = await admin.auth.admin.getUserById(targetUserId)
  if (authUserErr || !authUser.user) {
    throw new Error(`getUserById(${targetUserId}) failed: ${authUserErr?.message ?? 'not found'}`)
  }
  console.log(`id:    ${authUser.user.id}`)
  console.log(`email: ${authUser.user.email}`)
  console.log(`created_at: ${authUser.user.created_at}`)

  // 2. Find tenant
  console.log('\n=== Tenant ===')
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('*')
    .eq('owner_user_id', authUser.user.id)
    .maybeSingle()
  if (tenantErr) throw new Error(`tenants: ${tenantErr.message}`)
  if (!tenant) { console.log('No tenant found for this user.'); process.exit(0) }
  console.log(JSON.stringify(tenant, null, 2))

  // 3. Fetch parcele (all columns)
  console.log('\n=== Parcele ===')
  const { data: parcele, error: parceleErr } = await admin
    .from('parcele')
    .select('*')
    .eq('tenant_id', tenant.id)
    .limit(5)
  if (parceleErr) {
    console.error(`parcele error: ${parceleErr.message}`)
  } else {
    console.log(`Count (first 5 rows returned): ${parcele?.length ?? 0}`)
    if (parcele && parcele.length > 0) {
      console.log('Columns:', Object.keys(parcele[0]).join(', '))
      const hasStadiu = 'stadiu' in parcele[0]
      console.log(`Has 'stadiu' column: ${hasStadiu}`)
      console.log('\nFirst row:')
      console.log(JSON.stringify(parcele[0], null, 2))
    }
  }

  // 4. Try explicit stadiu select
  console.log('\n=== Test select with stadiu ===')
  const { data: stadiuTest, error: stadiuErr } = await admin
    .from('parcele')
    .select('id,stadiu')
    .eq('tenant_id', tenant.id)
    .limit(1)
  if (stadiuErr) {
    console.error(`stadiu select FAILED: ${stadiuErr.message}`)
    console.log('→ Migration 20260314_add_stadiu_to_parcele.sql has NOT been applied.')
  } else {
    console.log('stadiu select OK:', JSON.stringify(stadiuTest))
    console.log('→ Migration is applied.')
  }

  // 5. Test write access: insert + delete a dummy row
  console.log('\n=== Test write (insert + delete dummy) ===')
  const { data: inserted, error: insertErr } = await admin
    .from('parcele')
    .insert({
      tenant_id: tenant.id,
      id_parcela: '__debug_test__',
      nume_parcela: '__debug__',
      tip_unitate: 'camp',
      suprafata_m2: 0,
      an_plantare: 2024,
      status: 'Activ',
    })
    .select('id')
    .single()

  if (insertErr) {
    console.error(`Insert FAILED: ${insertErr.message}`)
  } else {
    console.log(`Inserted dummy row id: ${inserted.id}`)
    const { error: delErr } = await admin.from('parcele').delete().eq('id', inserted.id)
    if (delErr) {
      console.error(`Delete FAILED: ${delErr.message}`)
    } else {
      console.log('Deleted dummy row. Write access OK.')
    }
  }

  console.log('\n=== Debug complete ===')
}

main().catch((err) => {
  console.error('debug-db failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
