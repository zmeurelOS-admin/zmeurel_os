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
  operatorEmail: string
  operatorPassword: string
  operatorUserId: string
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
  operatorEmail: '',
  operatorPassword: 'Operator-rls-123!',
  operatorUserId: '',
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
) {
  const { error } = await admin.from('farm_members').insert({
    tenant_id: tenantId,
    user_id: userId,
    name: `Operator ${context.runId}`,
    role: 'operator',
    is_active: true,
    modules_access: [],
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

beforeAll(async () => {
  context.ownerEmail = `financial-owner.${context.runId}@zmeurel-rls-test.local`
  context.operatorEmail = `financial-operator.${context.runId}@zmeurel-rls-test.local`
  context.outsiderEmail = `financial-outsider.${context.runId}@zmeurel-rls-test.local`

  context.ownerUserId = await createAuthUser(context.admin, context.ownerEmail, context.ownerPassword)
  context.operatorUserId = await createAuthUser(context.admin, context.operatorEmail, context.operatorPassword)
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
  await ensureProfile(context.admin, context.operatorUserId, null)
  await ensureProfile(context.admin, context.outsiderUserId, context.outsiderTenantId)
  await createOperatorMembership(context.admin, context.ownerTenantId, context.operatorUserId)
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
  if (context.operatorUserId) {
    await context.admin.from('farm_members').delete().eq('user_id', context.operatorUserId)
  }
  if (context.ownerUserId) {
    await context.admin.from('profiles').delete().eq('id', context.ownerUserId)
  }
  if (context.operatorUserId) {
    await context.admin.from('profiles').delete().eq('id', context.operatorUserId)
  }
  if (context.outsiderUserId) {
    await context.admin.from('profiles').delete().eq('id', context.outsiderUserId)
  }
  if (context.ownerTenantId) {
    await context.admin.from('tenants').delete().eq('id', context.ownerTenantId)
  }
  if (context.outsiderTenantId) {
    await context.admin.from('tenants').delete().eq('id', context.outsiderTenantId)
  }
  if (context.ownerUserId) {
    await deleteAuthUser(context.admin, context.ownerUserId)
  }
  if (context.operatorUserId) {
    await deleteAuthUser(context.admin, context.operatorUserId)
  }
  if (context.outsiderUserId) {
    await deleteAuthUser(context.admin, context.outsiderUserId)
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

  it('blochează operatorul la select/insert/update/delete direct pe cheltuieli și investiții', async () => {
    const operatorClient = await createTestUserClient(context.operatorEmail, context.operatorPassword)
    const today = todayIso()

    try {
      const { data: visibleCheltuieli, error: selectCheltuieliError } = await operatorClient
        .from('cheltuieli_diverse')
        .select('id,tenant_id')

      expect(selectCheltuieliError).toBeNull()
      expect((visibleCheltuieli ?? []).find((row) => row.id === context.seededCheltuialaId)).toBeUndefined()

      const { data: visibleInvestitii, error: selectInvestitiiError } = await operatorClient
        .from('investitii')
        .select('id,tenant_id')

      expect(selectInvestitiiError).toBeNull()
      expect((visibleInvestitii ?? []).find((row) => row.id === context.seededInvestitieId)).toBeUndefined()

      const operatorCheltBusinessId = `CH-RLS-${context.runId}-OP`
      const { data: operatorInsertedCheltuiala, error: operatorInsertCheltuialaError } = await operatorClient
        .from('cheltuieli_diverse')
        .insert({
          tenant_id: context.ownerTenantId,
          id_cheltuiala: operatorCheltBusinessId,
          client_sync_id: `chelt-op-${context.runId}`,
          data: today,
          categorie: 'Ambalaje',
          suma_lei: 99,
        })
        .select('id')

      expect(
        isPermissionDenied(operatorInsertCheltuialaError) ||
          (operatorInsertedCheltuiala ?? []).length === 0,
      ).toBe(true)

      const { data: operatorInsertedCheltuialaVerify, error: operatorInsertedCheltuialaVerifyError } = await context.admin
        .from('cheltuieli_diverse')
        .select('id')
        .eq('id_cheltuiala', operatorCheltBusinessId)

      expect(operatorInsertedCheltuialaVerifyError).toBeNull()
      expect(operatorInsertedCheltuialaVerify ?? []).toHaveLength(0)

      const operatorInvBusinessId = `INV-RLS-${context.runId}-OP`
      const { data: operatorInsertedInvestitie, error: operatorInsertInvestitieError } = await operatorClient
        .from('investitii')
        .insert({
          tenant_id: context.ownerTenantId,
          id_investitie: operatorInvBusinessId,
          data: today,
          categorie: 'Utilaje și echipamente',
          suma_lei: 9900,
        })
        .select('id')

      expect(
        isPermissionDenied(operatorInsertInvestitieError) ||
          (operatorInsertedInvestitie ?? []).length === 0,
      ).toBe(true)

      const { data: operatorInsertedInvestitieVerify, error: operatorInsertedInvestitieVerifyError } = await context.admin
        .from('investitii')
        .select('id')
        .eq('id_investitie', operatorInvBusinessId)

      expect(operatorInsertedInvestitieVerifyError).toBeNull()
      expect(operatorInsertedInvestitieVerify ?? []).toHaveLength(0)

      const { data: operatorUpdatedCheltuiala, error: operatorUpdateCheltuialaError } = await operatorClient
        .from('cheltuieli_diverse')
        .update({ suma_lei: 700 })
        .eq('id', context.seededCheltuialaId)
        .select('id,suma_lei')

      expect(
        isPermissionDenied(operatorUpdateCheltuialaError) ||
          (operatorUpdatedCheltuiala ?? []).length === 0,
      ).toBe(true)

      const { data: operatorCheltuialaAfterUpdate, error: operatorCheltuialaAfterUpdateError } = await context.admin
        .from('cheltuieli_diverse')
        .select('suma_lei')
        .eq('id', context.seededCheltuialaId)
        .single()

      expect(operatorCheltuialaAfterUpdateError).toBeNull()
      expect(operatorCheltuialaAfterUpdate?.suma_lei).toBe(111)

      const { data: operatorUpdatedInvestitie, error: operatorUpdateInvestitieError } = await operatorClient
        .from('investitii')
        .update({ suma_lei: 7000 })
        .eq('id', context.seededInvestitieId)
        .select('id,suma_lei')

      expect(
        isPermissionDenied(operatorUpdateInvestitieError) ||
          (operatorUpdatedInvestitie ?? []).length === 0,
      ).toBe(true)

      const { data: operatorInvestitieAfterUpdate, error: operatorInvestitieAfterUpdateError } = await context.admin
        .from('investitii')
        .select('suma_lei')
        .eq('id', context.seededInvestitieId)
        .single()

      expect(operatorInvestitieAfterUpdateError).toBeNull()
      expect(operatorInvestitieAfterUpdate?.suma_lei).toBe(2222)

      const { data: operatorDeletedCheltuiala, error: operatorDeleteCheltuialaError } = await operatorClient
        .from('cheltuieli_diverse')
        .delete()
        .eq('id', context.seededCheltuialaId)
        .select('id')

      expect(
        isPermissionDenied(operatorDeleteCheltuialaError) ||
          (operatorDeletedCheltuiala ?? []).length === 0,
      ).toBe(true)

      const { data: operatorCheltuialaAfterDelete, error: operatorCheltuialaAfterDeleteError } = await context.admin
        .from('cheltuieli_diverse')
        .select('id')
        .eq('id', context.seededCheltuialaId)

      expect(operatorCheltuialaAfterDeleteError).toBeNull()
      expect(operatorCheltuialaAfterDelete ?? []).toHaveLength(1)

      const { data: operatorDeletedInvestitie, error: operatorDeleteInvestitieError } = await operatorClient
        .from('investitii')
        .delete()
        .eq('id', context.seededInvestitieId)
        .select('id')

      expect(
        isPermissionDenied(operatorDeleteInvestitieError) ||
          (operatorDeletedInvestitie ?? []).length === 0,
      ).toBe(true)

      const { data: operatorInvestitieAfterDelete, error: operatorInvestitieAfterDeleteError } = await context.admin
        .from('investitii')
        .select('id')
        .eq('id', context.seededInvestitieId)

      expect(operatorInvestitieAfterDeleteError).toBeNull()
      expect(operatorInvestitieAfterDelete ?? []).toHaveLength(1)
    } finally {
      await operatorClient.auth.signOut()
    }
  })

  it('blochează utilizatorul din alt tenant la cheltuieli și investiții', async () => {
    const outsiderClient = await createTestUserClient(context.outsiderEmail, context.outsiderPassword)
    const today = todayIso()

    try {
      const { data: outsiderCheltuieli, error: outsiderCheltuieliError } = await outsiderClient
        .from('cheltuieli_diverse')
        .select('id,tenant_id')

      expect(outsiderCheltuieliError).toBeNull()
      expect((outsiderCheltuieli ?? []).find((row) => row.id === context.seededCheltuialaId)).toBeUndefined()

      const { data: outsiderInvestitii, error: outsiderInvestitiiError } = await outsiderClient
        .from('investitii')
        .select('id,tenant_id')

      expect(outsiderInvestitiiError).toBeNull()
      expect((outsiderInvestitii ?? []).find((row) => row.id === context.seededInvestitieId)).toBeUndefined()

      const outsiderCheltBusinessId = `CH-RLS-${context.runId}-OUT`
      const { data: outsiderInsertedCheltuiala, error: outsiderInsertCheltuialaError } = await outsiderClient
        .from('cheltuieli_diverse')
        .insert({
          tenant_id: context.ownerTenantId,
          id_cheltuiala: outsiderCheltBusinessId,
          client_sync_id: `chelt-out-${context.runId}`,
          data: today,
          categorie: 'Ambalaje',
          suma_lei: 77,
        })
        .select('id')

      expect(
        isPermissionDenied(outsiderInsertCheltuialaError) ||
          (outsiderInsertedCheltuiala ?? []).length === 0,
      ).toBe(true)

      const { data: outsiderCheltuialaVerify, error: outsiderCheltuialaVerifyError } = await context.admin
        .from('cheltuieli_diverse')
        .select('id')
        .eq('id_cheltuiala', outsiderCheltBusinessId)

      expect(outsiderCheltuialaVerifyError).toBeNull()
      expect(outsiderCheltuialaVerify ?? []).toHaveLength(0)

      const outsiderInvBusinessId = `INV-RLS-${context.runId}-OUT`
      const { data: outsiderInsertedInvestitie, error: outsiderInsertInvestitieError } = await outsiderClient
        .from('investitii')
        .insert({
          tenant_id: context.ownerTenantId,
          id_investitie: outsiderInvBusinessId,
          data: today,
          categorie: 'Utilaje și echipamente',
          suma_lei: 7700,
        })
        .select('id')

      expect(
        isPermissionDenied(outsiderInsertInvestitieError) ||
          (outsiderInsertedInvestitie ?? []).length === 0,
      ).toBe(true)

      const { data: outsiderInvestitieVerify, error: outsiderInvestitieVerifyError } = await context.admin
        .from('investitii')
        .select('id')
        .eq('id_investitie', outsiderInvBusinessId)

      expect(outsiderInvestitieVerifyError).toBeNull()
      expect(outsiderInvestitieVerify ?? []).toHaveLength(0)
    } finally {
      await outsiderClient.auth.signOut()
    }
  })
})
