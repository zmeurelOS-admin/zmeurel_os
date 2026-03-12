import { config } from 'dotenv'

config({ path: '.env.local' })

import { getSupabaseAdmin } from '../src/lib/supabase/admin'
import { seedDemoData } from '../src/lib/supabase/seed-demo-data'

const PAGE_SIZE = 200

async function findUserByEmail(email: string) {
  const admin = getSupabaseAdmin()
  const normalizedEmail = email.trim().toLowerCase()
  let page = 1

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    })

    if (error) {
      throw new Error(`Failed listing users on page ${page}: ${error.message}`)
    }

    const users = data?.users ?? []
    const match = users.find((user) => (user.email ?? '').toLowerCase() === normalizedEmail)
    if (match) return match

    if (users.length < PAGE_SIZE) break
    page += 1
  }

  return null
}

async function main() {
  const emailArg = process.argv[2]
  if (!emailArg) {
    console.error('Usage: npx tsx scripts/seed-existing-tenant.ts <email>')
    process.exit(1)
  }

  const admin = getSupabaseAdmin()

  const user = await findUserByEmail(emailArg)
  if (!user) {
    throw new Error(`User not found for email: ${emailArg}`)
  }
  console.log('User found:', { id: user.id, email: user.email })

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (tenantError) {
    throw new Error(`Failed fetching tenant for user ${user.id}: ${tenantError.message}`)
  }

  console.log('Tenant lookup result:', { tenant })

  const tenantId = tenant?.id ?? null
  if (!tenantId) {
    throw new Error(`No tenant found for user ${user.id} (${emailArg})`)
  }

  const result = await seedDemoData(admin, tenantId, user.id)

  if (!result.success) {
    console.error('Seed failed:', result.error)
    console.error('Partial summary:', result.summary)
    process.exit(1)
  }

  console.log('Seed success for:', emailArg)
  console.log('Tenant:', tenantId)
  console.log('Summary:', result.summary)
}

main().catch((error) => {
  console.error('Script failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
