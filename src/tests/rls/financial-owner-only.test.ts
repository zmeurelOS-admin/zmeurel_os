import crypto from 'node:crypto'

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestAdminClient, createTestUserClient } from '@/tests/rls/helpers/supabase-test-client'
import type { Database } from '@/types/supabase'

type AdminClient = SupabaseClient<Database>

type TestContext = {
  admin: AdminClient
  runId: string
  ownerEmail: string
  ownerPassword: string
  ownerUserId: string
  operatorReadEmail: string
  operatorReadPassword: string
  operatorReadUserId: string
  operatorWriteEmail: string
  operatorWritePassword: string
  operatorWriteUserId: string
  outsiderEmail: string
  outsiderPassword: string
  outsiderUserId: string
  ownerTenantId: string
  outsiderTenantId: string
  seededCheltuialaId: string
  seededInvestitieId: string
  ownerCreatedCheltuialaId: string
  ownerCreatedInvestitieId: string
}

const context: TestContext = {
  admin: createTestAdminClient(),
  runId: crypto.randomUUID().slice(0, 8),
  ownerEmail: '',
  ownerPassword: 'Owner-rls-123!',
  ownerUserId: '',
  operatorReadEmail: '',
  operatorReadPassword: 'Operator-read-123!',
  operatorReadUserId: '',
  operatorWriteEmail: '',
  operatorWritePassword: 'Operator-write-123!',
  operatorWriteUserId: '',
  outsiderEmail: '',
  outsiderPassword: 'Outsider-rls-123!',
  outsiderUserId: '',
  ownerTenantId: '',
  outsiderTenantId: '',
  seededCheltuialaId: '',
  seededInvestitieId: '',
  ownerCreatedCheltuialaId: '',
  ownerCreatedInvestitieId: '',
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function expectId(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing ${label}`)
  }

  return value
}

function isPermissionDenied(error: PostgrestError | null): boolean {
  if (!error) return false
  const code = (error.code ?? '').toUpperCase()
  return code === '42501' || code === 'PGRST301'
}

async function createAuthUser(
  admin: AdminClient,
  email: string,
  password: string,
) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    throw new Error(`Failed creating auth user ${email}: ${error.message}`)
  }

  return expectId(data.user?.id, `auth user id for ${email}`)
}

async function deleteAuthUser(admin: AdminClient, userId: string) {
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    throw new Error(`Failed deleting auth user ${userId}: ${error.message}`)
  }
}

async function createTenant(admin: AdminClient, ownerUserId: string, name: string) {
  const { data, error } = await admin
    .from('tenants')
    .insert({
      owner_user_id: ownerUserId,
      nume_ferma: name,
      plan: 'freemium',
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed creating tenant ${name}: ${error.message}`)
  }

  return data.id
}

async function ensureProfile(
  admin: AdminClient,
  userId: string,
  tenantId: string | null,
) {
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      tenant_id: tenantId,
      is_superadmin: false,
    },
    {
      onConflict: 'id',
    },
  )

  if (error) {
    throw new Error(`Failed upserting profile ${userId}: ${error.message}`)
  }
}

async function createOperatorMembership(
  admin: AdminClient,
  tenantId: string,
  userId: string,
  modulesAccess: Array<{ module: string; level: 'read' | 'write' }>,
) {
  const { error } = await admin.from('farm_members').insert({
    tenant_id: tenantId,
    user_id: userId,
    name: `Operator ${context.runId}`,
    role: 'operator',
    is_active: true,
    modules_access: modulesAccess,
  })

  if (error) {
    throw new Error(`Failed creating operator membership: ${error.message}`)
  }
}

async function seedFinancialRows(admin: AdminClient) {
  const today = todayIso()

  const { data: cheltuiala, error: cheltuialaError } = await admin
    .from('cheltuieli_diverse')
    .insert({
      tenant_id: context.ownerTenantId,
      id_cheltuiala: `CH-RLS-${context.runId}-SEED`,
      client_sync_id: `chelt-seed-${context.runId}`,
      data: today,
      categorie: 'Ambalaje',
      descriere: `Seed cheltuiala ${context.runId}`,
      suma_lei: 111,
      furnizor: 'Seed SRL',
    })
    .select('id')
    .single()

  if (cheltuialaError) {
    throw new Error(`Failed seeding cheltuiala: ${cheltuialaError.message}`)
  }
  context.seededCheltuialaId = cheltuiala.id

  const { data: investitie, error: investitieError } = await admin
    .from('investitii')
    .insert({
      tenant_id: context.ownerTenantId,
      id_investitie: `INV-RLS-${context.runId}-SEED`,
      data: today,
      categorie: 'Utilaje și echipamente',
      descriere: `Seed investitie ${context.runId}`,
      suma_lei: 2222,
      furnizor: 'Seed Invest SRL',
    })
    .select('id')
    .single()

  if (investitieError) {
    throw new Error(`Failed seeding investitie: ${investitieError.message}`)
  }
  context.seededInvestitieId = investitie.id
}

async function assertNoAdminRows(
  table: 'cheltuieli_diverse' | 'investitii',
  businessColumn: 'id_cheltuiala' | 'id_investitie',
  businessValue: string,
) {
  const { data, error } = await context.admin
    .from(table)
    .select('id')
    .eq(businessColumn, businessValue)

  expect(error).toBeNull()
  expect(data ?? []).toHaveLength(0)
}

async function assertBlockedFinancialAccess(
  client: SupabaseClient<Database>,
  actorLabel: string,
) {
  const today = todayIso()

  const { data: visibleCheltuieli, error: selectCheltuieliError } = await client
    .from('cheltuieli_diverse')
    .select('id,tenant_id')

  expect(selectCheltuieliError).toBeNull()
  expect((visibleCheltuieli ?? []).find((row) => row.id === context.seededCheltuialaId)).toBeUndefined()

  const { data: visibleInvestitii, error: selectInvestitiiError } = await client
    .from('investitii')
    .select('id,tenant_id')

  expect(selectInvestitiiError).toBeNull()
  expect((visibleInvestitii ?? []).find((row) => row.id === context.seededInvestitieId)).toBeUndefined()

  const cheltBusinessId = `CH-RLS-${context.runId}-${actorLabel}`
  const { data: insertedCheltuiala, error: insertCheltuialaError } = await client
    .from('cheltuieli_diverse')
    .insert({
      tenant_id: context.ownerTenantId,
      id_cheltuiala: cheltBusinessId,
      client_sync_id: `chelt-${actorLabel}-${context.runId}`,
      data: today,
      categorie: 'Ambalaje',
      suma_lei: 99,
    })
    .select('id')

  expect(
    isPermissionDenied(insertCheltuialaError) ||
      (insertedCheltuiala ?? []).length === 0,
  ).toBe(true)
  await assertNoAdminRows('cheltuieli_diverse', 'id_cheltuiala', cheltBusinessId)

  const invBusinessId = `INV-RLS-${context.runId}-${actorLabel}`
  const { data: insertedInvestitie, error: insertInvestitieError } = await client
    .from('investitii')
    .insert({
      tenant_id: context.ownerTenantId,
      id_investitie: invBusinessId,
      data: today,
      categorie: 'Utilaje și echipamente',
      suma_lei: 9900,
    })
    .select('id')

  expect(
    isPermissionDenied(insertInvestitieError) ||
      (insertedInvestitie ?? []).length === 0,
  ).toBe(true)
  await assertNoAdminRows('investitii', 'id_investitie', invBusinessId)

  const { data: updatedCheltuiala, error: updateCheltuialaError } = await client
    .from('cheltuieli_diverse')
    .update({ suma_lei: 700 })
    .eq('id', context.seededCheltuialaId)
    .select('id,suma_lei')

  expect(
    isPermissionDenied(updateCheltuialaError) ||
      (updatedCheltuiala ?? []).length === 0,
  ).toBe(true)

  const { data: cheltuialaAfterUpdate, error: cheltuialaAfterUpdateError } = await context.admin
    .from('cheltuieli_diverse')
    .select('suma_lei')
    .eq('id', context.seededCheltuialaId)
    .single()

  expect(cheltuialaAfterUpdateError).toBeNull()
  expect(cheltuialaAfterUpdate?.suma_lei).toBe(111)

  const { data: updatedInvestitie, error: updateInvestitieError } = await client
    .from('investitii')
    .update({ suma_lei: 7000 })
    .eq('id', context.seededInvestitieId)
    .select('id,suma_lei')

  expect(
    isPermissionDenied(updateInvestitieError) ||
      (updatedInvestitie ?? []).length === 0,
  ).toBe(true)

  const { data: investitieAfterUpdate, error: investitieAfterUpdateError } = await context.admin
    .from('investitii')
    .select('suma_lei')
    .eq('id', context.seededInvestitieId)
    .single()

  expect(investitieAfterUpdateError).toBeNull()
  expect(investitieAfterUpdate?.suma_lei).toBe(2222)

  const { data: deletedCheltuiala, error: deleteCheltuialaError } = await client
    .from('cheltuieli_diverse')
    .delete()
    .eq('id', context.seededCheltuialaId)
    .select('id')

  expect(
    isPermissionDenied(deleteCheltuialaError) ||
      (deletedCheltuiala ?? []).length === 0,
  ).toBe(true)

  const { data: cheltuialaAfterDelete, error: cheltuialaAfterDeleteError } = await context.admin
    .from('cheltuieli_diverse')
    .select('id')
    .eq('id', context.seededCheltuialaId)

  expect(cheltuialaAfterDeleteError).toBeNull()
  expect(cheltuialaAfterDelete ?? []).toHaveLength(1)

  const { data: deletedInvestitie, error: deleteInvestitieError } = await client
    .from('investitii')
    .delete()
    .eq('id', context.seededInvestitieId)
    .select('id')

  expect(
    isPermissionDenied(deleteInvestitieError) ||
      (deletedInvestitie ?? []).length === 0,
  ).toBe(true)

  const { data: investitieAfterDelete, error: investitieAfterDeleteError } = await context.admin
    .from('investitii')
    .select('id')
    .eq('id', context.seededInvestitieId)

  expect(investitieAfterDeleteError).toBeNull()
  expect(investitieAfterDelete ?? []).toHaveLength(1)
}

beforeAll(async () => {
  context.ownerEmail = `financial-owner.${context.runId}@zmeurel-rls-test.local`
  context.operatorReadEmail = `financial-operator-read.${context.runId}@zmeurel-rls-test.local`
  context.operatorWriteEmail = `financial-operator-write.${context.runId}@zmeurel-rls-test.local`
  context.outsiderEmail = `financial-outsider.${context.runId}@zmeurel-rls-test.local`

  context.ownerUserId = await createAuthUser(context.admin, context.ownerEmail, context.ownerPassword)
  context.operatorReadUserId = await createAuthUser(
    context.admin,
    context.operatorReadEmail,
    context.operatorReadPassword,
  )
  context.operatorWriteUserId = await createAuthUser(
    context.admin,
    context.operatorWriteEmail,
    context.operatorWritePassword,
  )
  context.outsiderUserId = await createAuthUser(context.admin, context.outsiderEmail, context.outsiderPassword)

  context.ownerTenantId = await createTenant(
    context.admin,
    context.ownerUserId,
    `Financial owner tenant ${context.runId}`,
  )
  context.outsiderTenantId = await createTenant(
    context.admin,
    context.outsiderUserId,
    `Financial outsider tenant ${context.runId}`,
  )

  await ensureProfile(context.admin, context.ownerUserId, context.ownerTenantId)
  await ensureProfile(context.admin, context.operatorReadUserId, null)
  await ensureProfile(context.admin, context.operatorWriteUserId, null)
  await ensureProfile(context.admin, context.outsiderUserId, context.outsiderTenantId)
  await createOperatorMembership(context.admin, context.ownerTenantId, context.operatorReadUserId, [
    { module: 'cheltuieli', level: 'read' },
    { module: 'investitii', level: 'read' },
  ])
  await createOperatorMembership(context.admin, context.ownerTenantId, context.operatorWriteUserId, [
    { module: 'cheltuieli', level: 'write' },
    { module: 'investitii', level: 'write' },
  ])
  await seedFinancialRows(context.admin)
})

afterAll(async () => {
  if (context.ownerCreatedCheltuialaId) {
    await context.admin.from('cheltuieli_diverse').delete().eq('id', context.ownerCreatedCheltuialaId)
  }
  if (context.ownerCreatedInvestitieId) {
    await context.admin.from('investitii').delete().eq('id', context.ownerCreatedInvestitieId)
  }
  if (context.seededCheltuialaId) {
    await context.admin.from('cheltuieli_diverse').delete().eq('id', context.seededCheltuialaId)
  }
  if (context.seededInvestitieId) {
    await context.admin.from('investitii').delete().eq('id', context.seededInvestitieId)
  }
  if (context.operatorReadUserId) {
    await context.admin.from('farm_members').delete().eq('user_id', context.operatorReadUserId)
  }
  if (context.operatorWriteUserId) {
    await context.admin.from('farm_members').delete().eq('user_id', context.operatorWriteUserId)
  }
  for (const userId of [
    context.ownerUserId,
    context.operatorReadUserId,
    context.operatorWriteUserId,
    context.outsiderUserId,
  ]) {
    if (userId) {
      await context.admin.from('profiles').delete().eq('id', userId)
    }
  }
  if (context.ownerTenantId) {
    await context.admin.from('tenants').delete().eq('id', context.ownerTenantId)
  }
  if (context.outsiderTenantId) {
    await context.admin.from('tenants').delete().eq('id', context.outsiderTenantId)
  }
  for (const userId of [
    context.ownerUserId,
    context.operatorReadUserId,
    context.operatorWriteUserId,
    context.outsiderUserId,
  ]) {
    if (userId) {
      await deleteAuthUser(context.admin, userId)
    }
  }
})

describe('financial owner-only RLS', () => {
  it('permite ownerului CRUD complet pe cheltuieli și investiții', async () => {
    const ownerClient = await createTestUserClient(context.ownerEmail, context.ownerPassword)
    const today = todayIso()

    try {
      const { data: insertedCheltuiala, error: insertCheltuialaError } = await ownerClient
        .from('cheltuieli_diverse')
        .insert({
          tenant_id: context.ownerTenantId,
          id_cheltuiala: `CH-RLS-${context.runId}-OWNER`,
          client_sync_id: `chelt-owner-${context.runId}`,
          data: today,
          categorie: 'Combustibil',
          descriere: 'Owner direct insert',
          suma_lei: 321,
          furnizor: 'Owner Fuel SRL',
        })
        .select('id,tenant_id,suma_lei')
        .single()

      expect(insertCheltuialaError).toBeNull()
      expect(insertedCheltuiala?.tenant_id).toBe(context.ownerTenantId)
      expect(insertedCheltuiala?.suma_lei).toBe(321)
      context.ownerCreatedCheltuialaId = expectId(insertedCheltuiala?.id, 'owner cheltuiala id')

      const { data: selectedCheltuiala, error: selectCheltuialaError } = await ownerClient
        .from('cheltuieli_diverse')
        .select('id,tenant_id,suma_lei')
        .eq('id', context.ownerCreatedCheltuialaId)
        .single()

      expect(selectCheltuialaError).toBeNull()
      expect(selectedCheltuiala?.tenant_id).toBe(context.ownerTenantId)

      const { data: updatedCheltuiala, error: updateCheltuialaError } = await ownerClient
        .from('cheltuieli_diverse')
        .update({ suma_lei: 654, descriere: 'Owner direct update' })
        .eq('id', context.ownerCreatedCheltuialaId)
        .select('id,suma_lei,descriere')
        .single()

      expect(updateCheltuialaError).toBeNull()
      expect(updatedCheltuiala?.suma_lei).toBe(654)
      expect(updatedCheltuiala?.descriere).toBe('Owner direct update')

      const { data: insertedInvestitie, error: insertInvestitieError } = await ownerClient
        .from('investitii')
        .insert({
          tenant_id: context.ownerTenantId,
          id_investitie: `INV-RLS-${context.runId}-OWNER`,
          data: today,
          categorie: 'Infrastructură și utilități',
          descriere: 'Owner CAPEX insert',
          suma_lei: 4567,
          furnizor: 'Owner Infra SRL',
        })
        .select('id,tenant_id,suma_lei')
        .single()

      expect(insertInvestitieError).toBeNull()
      expect(insertedInvestitie?.tenant_id).toBe(context.ownerTenantId)
      context.ownerCreatedInvestitieId = expectId(insertedInvestitie?.id, 'owner investitie id')

      const { data: selectedInvestitie, error: selectInvestitieError } = await ownerClient
        .from('investitii')
        .select('id,tenant_id,suma_lei')
        .eq('id', context.ownerCreatedInvestitieId)
        .single()

      expect(selectInvestitieError).toBeNull()
      expect(selectedInvestitie?.tenant_id).toBe(context.ownerTenantId)

      const { data: updatedInvestitie, error: updateInvestitieError } = await ownerClient
        .from('investitii')
        .update({ suma_lei: 7654, descriere: 'Owner CAPEX update' })
        .eq('id', context.ownerCreatedInvestitieId)
        .select('id,suma_lei,descriere')
        .single()

      expect(updateInvestitieError).toBeNull()
      expect(updatedInvestitie?.suma_lei).toBe(7654)
      expect(updatedInvestitie?.descriere).toBe('Owner CAPEX update')

      const { error: deleteCheltuialaError } = await ownerClient
        .from('cheltuieli_diverse')
        .delete()
        .eq('id', context.ownerCreatedCheltuialaId)

      expect(deleteCheltuialaError).toBeNull()

      const { data: deletedCheltuialaRows, error: verifyDeleteCheltuialaError } = await context.admin
        .from('cheltuieli_diverse')
        .select('id')
        .eq('id', context.ownerCreatedCheltuialaId)

      expect(verifyDeleteCheltuialaError).toBeNull()
      expect(deletedCheltuialaRows ?? []).toHaveLength(0)
      context.ownerCreatedCheltuialaId = ''

      const { error: deleteInvestitieError } = await ownerClient
        .from('investitii')
        .delete()
        .eq('id', context.ownerCreatedInvestitieId)

      expect(deleteInvestitieError).toBeNull()

      const { data: deletedInvestitieRows, error: verifyDeleteInvestitieError } = await context.admin
        .from('investitii')
        .select('id')
        .eq('id', context.ownerCreatedInvestitieId)

      expect(verifyDeleteInvestitieError).toBeNull()
      expect(deletedInvestitieRows ?? []).toHaveLength(0)
      context.ownerCreatedInvestitieId = ''
    } finally {
      await ownerClient.auth.signOut()
    }
  })

  it('blochează operatorul can_write=false la select/insert/update/delete direct pe cheltuieli și investiții', async () => {
    const operatorClient = await createTestUserClient(context.operatorReadEmail, context.operatorReadPassword)

    try {
      await assertBlockedFinancialAccess(operatorClient, 'OPR')
    } finally {
      await operatorClient.auth.signOut()
    }
  })

  it('blochează operatorul can_write=true la select/insert/update/delete direct pe cheltuieli și investiții', async () => {
    const operatorClient = await createTestUserClient(context.operatorWriteEmail, context.operatorWritePassword)

    try {
      await assertBlockedFinancialAccess(operatorClient, 'OPW')
    } finally {
      await operatorClient.auth.signOut()
    }
  })

  it('blochează utilizatorul din alt tenant la select/insert/update/delete direct pe cheltuieli și investiții', async () => {
    const outsiderClient = await createTestUserClient(context.outsiderEmail, context.outsiderPassword)

    try {
      await assertBlockedFinancialAccess(outsiderClient, 'OUT')
    } finally {
      await outsiderClient.auth.signOut()
    }
  })
})
