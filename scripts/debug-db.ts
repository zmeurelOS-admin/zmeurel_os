/**
 * debug-db.ts
 * Connects with the service role key and prints a diagnostic report:
 *   - Andrei's auth user + tenant
 *   - Parcele for that tenant (columns + count)
 *   - Whether the `stadiu` column exists
 *   - Attempts a dry test-insert/delete to verify write access
 *
 * Run: npx tsx scripts/debug-db.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { getSupabaseAdmin } from '../src/lib/supabase/admin'

const PROTECTED_EMAIL = 'popa.andrei.sv@gmail.com'

async function main() {
  const admin = getSupabaseAdmin()

  // 1. Find Andrei's auth user
  console.log('=== Auth user ===')
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) throw new Error(`listUsers: ${listErr.message}`)

  const andrei = users.find((u) => u.email?.toLowerCase() === PROTECTED_EMAIL.toLowerCase())
  if (!andrei) {
    console.error(`NOT FOUND: ${PROTECTED_EMAIL}`)
    process.exit(1)
  }
  console.log(`id:    ${andrei.id}`)
  console.log(`email: ${andrei.email}`)
  console.log(`created_at: ${andrei.created_at}`)

  // 2. Find tenant
  console.log('\n=== Tenant ===')
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('*')
    .eq('owner_user_id', andrei.id)
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
