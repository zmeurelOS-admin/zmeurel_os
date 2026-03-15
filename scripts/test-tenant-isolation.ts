import { config } from 'dotenv'
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../src/types/supabase'

config({ path: '.env.local' })
config({ path: '.env.test' })

type TestContext = {
  runId: string
  tenantAUserId?: string
  tenantBUserId?: string
  tenantAId?: string
  tenantBId?: string
  parcelAId?: string
  parcelBId?: string
  clientBId?: string
  harvestBId?: string
  saleBId?: string
  orderBId?: string
  stockMoveBId?: string
  alertDismissalBId?: string
}

type OwnedTenant = {
  id: string
  owner_user_id: string | null
  created_at?: string | null
}

type ExpectedProfilePrivileges = {
  tenant_id: string
  is_superadmin: boolean
}

function requireFirstEnv(...names: string[]): string {
  const value = names.map((name) => process.env[name]).find(Boolean)
  if (!value) {
    throw new Error(`Missing required environment variable. Tried: ${names.join(', ')}`)
  }

  return value
}

function createAdminClient(): SupabaseClient<Database> {
  const url = requireFirstEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireFirstEnv('SUPABASE_SERVICE_ROLE_KEY')

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function createUserClient(): SupabaseClient<Database> {
  const url = requireFirstEnv('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = requireFirstEnv('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function isPermissionDenied(error: PostgrestError): boolean {
  const code = (error.code ?? '').toUpperCase()
  return code === '42501' || code === 'PGRST301'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

async function createAuthUser(
  admin: SupabaseClient<Database>,
  label: 'tenant_a_owner' | 'tenant_b_owner',
  runId: string,
  password: string
) {
  const email = `${label}.${runId}@example.test`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: label,
      isolation_test_run_id: runId,
    },
  })

  if (error) {
    throw new Error(`Failed creating auth user ${label}: ${error.message}`)
  }

  const userId = data.user?.id
  assertCondition(userId, `Auth user ${label} was created without an id`)

  return { id: userId, email }
}

async function createTenant(
  userClient: SupabaseClient<Database>,
  ownerUserId: string,
  name: string
) {
  const { data, error } = await userClient
    .from('tenants')
    .insert({
      owner_user_id: ownerUserId,
      nume_ferma: name,
      plan: 'freemium',
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed creating tenant for ${ownerUserId}: ${error.message}`)
  }

  return data.id
}

async function listOwnedTenants(
  admin: SupabaseClient<Database>,
  ownerUserId: string
) {
  const { data, error } = await admin
    .from('tenants')
    .select('id,owner_user_id,created_at')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed reading tenants for ${ownerUserId}: ${error.message}`)
  }

  return (data ?? []) as OwnedTenant[]
}

async function ensureTenantForUser(
  admin: SupabaseClient<Database>,
  userClient: SupabaseClient<Database>,
  ownerUserId: string,
  name: string
) {
  const existingTenants = await listOwnedTenants(admin, ownerUserId)
  if (existingTenants.length > 0) {
    if (existingTenants.length > 1) {
      console.warn(
        `User ${ownerUserId} already has ${existingTenants.length} tenants. Reusing ${existingTenants[0].id} for isolation test.`
      )
    }
    return existingTenants[0].id
  }

  return createTenant(userClient, ownerUserId, name)
}

function isMissingTenantIdColumn(error: PostgrestError): boolean {
  const code = (error.code ?? '').toUpperCase()
  const message = error.message.toLowerCase()
  return code === '42703' || code === 'PGRST204' || message.includes('tenant_id')
}

async function ensureProfileTenant(
  admin: SupabaseClient<Database>,
  userId: string,
  tenantId: string
) {
  const adminAny = admin as any

  const { error: ensureProfileError } = await adminAny
    .from('profiles')
    .upsert(
      {
        id: userId,
        is_superadmin: false,
      },
      {
        onConflict: 'id',
      }
    )

  if (ensureProfileError) {
    throw new Error(`Failed ensuring profile for ${userId}: ${ensureProfileError.message}`)
  }

  const { error: syncTenantError } = await adminAny
    .from('profiles')
    .update({
      tenant_id: tenantId,
    })
    .eq('id', userId)

  if (syncTenantError) {
    if (isMissingTenantIdColumn(syncTenantError)) {
      console.warn(`profiles.tenant_id is not available yet for ${userId}; skipping profile tenant sync.`)
      return
    }

    throw new Error(`Failed syncing profiles.tenant_id for ${userId}: ${syncTenantError.message}`)
  }
}

async function insertParcel(
  userClient: SupabaseClient<Database>,
  tenantId: string,
  runId: string,
  idSuffix: 'A' | 'B',
  parcelName: string
) {
  const { data, error } = await userClient
    .from('parcele')
    .insert({
      tenant_id: tenantId,
      id_parcela: `TI-${runId}-${idSuffix}`,
      nume_parcela: parcelName,
      suprafata_m2: 100,
      an_plantare: 2024,
      status: 'Activ',
      tip_unitate: 'camp',
      tip_fruct: 'Zmeura',
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed inserting parcel ${parcelName}: ${error.message}`)
  }

  return data.id
}

async function signInAs(
  userClient: SupabaseClient<Database>,
  email: string,
  password: string
) {
  const { error } = await userClient.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(`Failed to sign in as ${email}: ${error.message}`)
  }
}

async function cleanup(admin: SupabaseClient<Database>, context: TestContext) {
  const userIds = [context.tenantAUserId, context.tenantBUserId].filter(Boolean) as string[]
  const tenantIdSet = new Set<string>([context.tenantAId, context.tenantBId].filter(Boolean) as string[])

  for (const userId of userIds) {
    const ownedTenants = await listOwnedTenants(admin, userId)
    for (const tenant of ownedTenants) {
      tenantIdSet.add(tenant.id)
    }
  }

  const tenantIds = [...tenantIdSet]
  if (tenantIds.length > 0) {
    await admin.from('tenants').delete().in('id', tenantIds)
  }

  if (userIds.length > 0) {
    await admin.from('profiles').delete().in('id', userIds)
  }

  for (const userId of userIds) {
    await admin.auth.admin.deleteUser(userId)
  }
}

async function insertClient(
  userClient: SupabaseClient<Database>,
  tenantId: string,
  runId: string
) {
  const clientAny = userClient as any
  const { data, error } = await clientAny
    .from('clienti')
    .insert({
      tenant_id: tenantId,
      id_client: `CLI-${runId}`,
      nume_client: `Client ${runId}`,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed inserting client for ${tenantId}: ${error.message}`)
  }

  return data.id as string
}

async function insertRecoltare(
  userClient: SupabaseClient<Database>,
  tenantId: string,
  parcelId: string,
  runId: string
) {
  const clientAny = userClient as any
  const { data, error } = await clientAny
    .from('recoltari')
    .insert({
      tenant_id: tenantId,
      id_recoltare: `REC-${runId}`,
      data: todayIso(),
      parcela_id: parcelId,
      kg_cal1: 2,
      kg_cal2: 1,
      cantitate_kg: 3,
      pret_lei_pe_kg_snapshot: 1,
      valoare_munca_lei: 3,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed inserting recoltare for ${tenantId}: ${error.message}`)
  }

  return data.id as string
}

async function insertVanzare(
  userClient: SupabaseClient<Database>,
  tenantId: string,
  clientId: string,
  runId: string
) {
  const clientAny = userClient as any
  const { data, error } = await clientAny
    .from('vanzari')
    .insert({
      tenant_id: tenantId,
      id_vanzare: `V-${runId}`,
      data: todayIso(),
      client_id: clientId,
      cantitate_kg: 4,
      pret_lei_kg: 12,
      status_plata: 'Platit',
      client_sync_id: crypto.randomUUID(),
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed inserting vanzare for ${tenantId}: ${error.message}`)
  }

  return data.id as string
}

async function insertComanda(
  userClient: SupabaseClient<Database>,
  tenantId: string,
  clientId: string
) {
  const clientAny = userClient as any
  const today = todayIso()
  const { data, error } = await clientAny
    .from('comenzi')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      data_comanda: today,
      data_livrare: today,
      cantitate_kg: 5,
      pret_per_kg: 10,
      total: 50,
      status: 'noua',
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed inserting comanda for ${tenantId}: ${error.message}`)
  }

  return data.id as string
}

async function insertMiscareStoc(
  userClient: SupabaseClient<Database>,
  tenantId: string,
  parcelId: string
) {
  const clientAny = userClient as any
  const { data, error } = await clientAny
    .from('miscari_stoc')
    .insert({
      tenant_id: tenantId,
      locatie_id: parcelId,
      produs: 'zmeura',
      calitate: 'cal1',
      depozit: 'fresh',
      tip: 'ajustare',
      tip_miscare: 'ajustare',
      cantitate_kg: 1,
      cantitate_cal1: 1,
      cantitate_cal2: 0,
      data: todayIso(),
      observatii: 'tenant-b-stock-row',
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed inserting miscari_stoc for ${tenantId}: ${error.message}`)
  }

  return data.id as string
}

async function insertAlertDismissal(
  userClient: SupabaseClient<Database>,
  tenantId: string,
  userId: string,
  runId: string
) {
  const clientAny = userClient as any
  const { data, error } = await clientAny
    .from('alert_dismissals')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      alert_key: `tenant-b-alert-${runId}`,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed inserting alert dismissal for ${tenantId}: ${error.message}`)
  }

  return data.id as string
}

async function assertRowHidden(
  userClient: SupabaseClient<Database>,
  table: string,
  rowId: string,
  label: string
) {
  const clientAny = userClient as any
  const { data, error } = await clientAny
    .from(table)
    .select('id')
    .eq('id', rowId)
    .maybeSingle()

  if (error && !isPermissionDenied(error)) {
    throw new Error(`Unexpected select error for ${label}: ${error.message}`)
  }

  assertCondition(!data, `Expected ${label} to be invisible across tenants`)
  console.log(`Read isolation check passed for ${label}.`)
}

async function assertUpdateBlocked(
  userClient: SupabaseClient<Database>,
  table: string,
  rowId: string,
  patch: Record<string, unknown>,
  label: string
) {
  const clientAny = userClient as any
  const { data, error } = await clientAny
    .from(table)
    .update(patch)
    .eq('id', rowId)
    .select('id')

  if (error && !isPermissionDenied(error)) {
    throw new Error(`Unexpected update error for ${label}: ${error.message}`)
  }

  if (!error) {
    assertCondition((data ?? []).length === 0, `Expected 0 updated rows for ${label}, got ${(data ?? []).length}`)
  }

  console.log(
    error
      ? `Update isolation check passed for ${label}: denied with code ${error.code ?? 'unknown'}.`
      : `Update isolation check passed for ${label}: 0 rows affected.`
  )
}

async function assertDeleteBlocked(
  userClient: SupabaseClient<Database>,
  table: string,
  rowId: string,
  label: string
) {
  const clientAny = userClient as any
  const { data, error } = await clientAny
    .from(table)
    .delete()
    .eq('id', rowId)
    .select('id')

  if (error && !isPermissionDenied(error)) {
    throw new Error(`Unexpected delete error for ${label}: ${error.message}`)
  }

  if (!error) {
    assertCondition((data ?? []).length === 0, `Expected 0 deleted rows for ${label}, got ${(data ?? []).length}`)
  }

  console.log(
    error
      ? `Delete isolation check passed for ${label}: denied with code ${error.code ?? 'unknown'}.`
      : `Delete isolation check passed for ${label}: 0 rows affected.`
  )
}

async function assertInsertBlocked(
  userClient: SupabaseClient<Database>,
  table: string,
  payload: Record<string, unknown>,
  label: string
) {
  const clientAny = userClient as any
  const { error } = await clientAny.from(table).insert(payload)

  if (!error) {
    throw new Error(`Expected insert to be blocked for ${label}, but it succeeded.`)
  }

  if (!isPermissionDenied(error)) {
    throw new Error(`Unexpected insert error for ${label}: ${error.message}`)
  }

  console.log(`Insert isolation check passed for ${label}: denied with code ${error.code ?? 'unknown'}.`)
}

async function assertRowStillExists(
  admin: SupabaseClient<Database>,
  table: string,
  rowId: string,
  label: string
) {
  const adminAny = admin as any
  const { data, error } = await adminAny
    .from(table)
    .select('id')
    .eq('id', rowId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed verifying ${label}: ${error.message}`)
  }

  assertCondition(data?.id === rowId, `${label} was modified or removed unexpectedly`)
}

async function assertOwnProfilePrivilegeEscalationBlocked(
  userClient: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  userId: string,
  patch: Record<string, unknown>,
  expected: ExpectedProfilePrivileges,
  label: string
) {
  const clientAny = userClient as any
  const { data, error } = await clientAny
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id,tenant_id,is_superadmin')
    .maybeSingle()

  if (!error && data) {
    throw new Error(`Expected profile privilege update to be blocked for ${label}, but it succeeded.`)
  }

  const adminAny = admin as any
  const { data: profile, error: verifyError } = await adminAny
    .from('profiles')
    .select('tenant_id,is_superadmin')
    .eq('id', userId)
    .single()

  if (verifyError) {
    throw new Error(`Failed verifying profile privilege protection for ${label}: ${verifyError.message}`)
  }

  assertCondition(profile.tenant_id === expected.tenant_id, `${label} unexpectedly changed profiles.tenant_id`)
  assertCondition(Boolean(profile.is_superadmin) === expected.is_superadmin, `${label} unexpectedly changed profiles.is_superadmin`)

  console.log(
    error
      ? `Profile privilege check passed for ${label}: blocked with code ${error.code ?? 'unknown'}.`
      : `Profile privilege check passed for ${label}: 0 rows affected.`
  )
}

async function main() {
  const admin = createAdminClient()
  const context: TestContext = {
    runId: Date.now().toString(36),
  }

  const testPassword = `Zmeurel!${context.runId}Aa1`
  let tenantAClient: SupabaseClient<Database> | null = null
  let tenantBClient: SupabaseClient<Database> | null = null

  try {
    console.log(`Starting tenant isolation test. runId=${context.runId}`)

    const userA = await createAuthUser(admin, 'tenant_a_owner', context.runId, testPassword)
    const userB = await createAuthUser(admin, 'tenant_b_owner', context.runId, testPassword)
    context.tenantAUserId = userA.id
    context.tenantBUserId = userB.id

    tenantAClient = createUserClient()
    tenantBClient = createUserClient()

    await signInAs(tenantAClient, userA.email, testPassword)
    await signInAs(tenantBClient, userB.email, testPassword)

    context.tenantAId = await ensureTenantForUser(admin, tenantAClient, userA.id, `Tenant A Isolation ${context.runId}`)
    context.tenantBId = await ensureTenantForUser(admin, tenantBClient, userB.id, `Tenant B Isolation ${context.runId}`)

    await ensureProfileTenant(admin, userA.id, context.tenantAId)
    await ensureProfileTenant(admin, userB.id, context.tenantBId)

    await assertOwnProfilePrivilegeEscalationBlocked(
      tenantAClient,
      admin,
      userA.id,
      { tenant_id: context.tenantBId },
      {
        tenant_id: context.tenantAId,
        is_superadmin: false,
      },
      'self profile tenant_id update'
    )

    await assertOwnProfilePrivilegeEscalationBlocked(
      tenantAClient,
      admin,
      userA.id,
      { is_superadmin: true },
      {
        tenant_id: context.tenantAId,
        is_superadmin: false,
      },
      'self profile is_superadmin update'
    )

    context.parcelAId = await insertParcel(tenantAClient, context.tenantAId, context.runId, 'A', 'A_test_parcel')
    context.parcelBId = await insertParcel(tenantBClient, context.tenantBId, context.runId, 'B', 'B_test_parcel')
    context.clientBId = await insertClient(tenantBClient, context.tenantBId, context.runId)
    context.harvestBId = await insertRecoltare(tenantBClient, context.tenantBId, context.parcelBId, context.runId)
    context.saleBId = await insertVanzare(tenantBClient, context.tenantBId, context.clientBId, context.runId)
    context.orderBId = await insertComanda(tenantBClient, context.tenantBId, context.clientBId)
    context.stockMoveBId = await insertMiscareStoc(tenantBClient, context.tenantBId, context.parcelBId)
    context.alertDismissalBId = await insertAlertDismissal(tenantBClient, context.tenantBId, userB.id, context.runId)

    const { data: visibleParcels, error: selectError } = await tenantAClient
      .from('parcele')
      .select('id,nume_parcela,id_parcela,tenant_id')
      .like('id_parcela', `TI-${context.runId}-%`)

    if (selectError) {
      throw new Error(`Failed selecting parcels as tenant_a_owner: ${selectError.message}`)
    }

    const parcelNames = (visibleParcels ?? []).map((row) => row.nume_parcela)
    assertCondition(parcelNames.length === 1, `Expected exactly 1 parcel visible to tenant_a_owner, got ${parcelNames.length}`)
    assertCondition(parcelNames[0] === 'A_test_parcel', `Expected only A_test_parcel, got: ${parcelNames.join(', ') || '[none]'}`)
    console.log('Read isolation check passed: only A_test_parcel is visible to tenant_a_owner.')

    const { data: updateRows, error: updateError } = await tenantAClient
      .from('parcele')
      .update({ observatii: 'cross-tenant-update-attempt' })
      .eq('id', context.parcelBId!)
      .select('id')

    if (updateError && !isPermissionDenied(updateError)) {
      throw new Error(`Unexpected update error for tenant B row: ${updateError.message}`)
    }
    if (!updateError) {
      assertCondition((updateRows ?? []).length === 0, `Expected 0 updated rows for tenant B parcel, got ${(updateRows ?? []).length}`)
    }
    console.log(
      updateError
        ? `Update isolation check passed: denied with code ${updateError.code ?? 'unknown'}.`
        : 'Update isolation check passed: 0 rows affected.'
    )

    const { data: deleteRows, error: deleteError } = await tenantAClient
      .from('parcele')
      .delete()
      .eq('id', context.parcelBId!)
      .select('id')

    if (deleteError && !isPermissionDenied(deleteError)) {
      throw new Error(`Unexpected delete error for tenant B row: ${deleteError.message}`)
    }
    if (!deleteError) {
      assertCondition((deleteRows ?? []).length === 0, `Expected 0 deleted rows for tenant B parcel, got ${(deleteRows ?? []).length}`)
    }
    console.log(
      deleteError
        ? `Delete isolation check passed: denied with code ${deleteError.code ?? 'unknown'}.`
        : 'Delete isolation check passed: 0 rows affected.'
    )

    const { data: stillExists, error: verifyError } = await admin
      .from('parcele')
      .select('id')
      .eq('id', context.parcelBId!)
      .maybeSingle()

    if (verifyError) {
      throw new Error(`Failed verifying tenant B parcel integrity: ${verifyError.message}`)
    }
    assertCondition(stillExists?.id === context.parcelBId, 'Tenant B parcel was modified or removed unexpectedly')

    await assertRowHidden(tenantAClient, 'clienti', context.clientBId!, 'tenant B client')
    await assertUpdateBlocked(tenantAClient, 'clienti', context.clientBId!, { observatii: 'cross-tenant-update-attempt' }, 'tenant B client')
    await assertDeleteBlocked(tenantAClient, 'clienti', context.clientBId!, 'tenant B client')

    await assertRowHidden(tenantAClient, 'recoltari', context.harvestBId!, 'tenant B recoltare')
    await assertUpdateBlocked(tenantAClient, 'recoltari', context.harvestBId!, { observatii: 'cross-tenant-update-attempt' }, 'tenant B recoltare')
    await assertDeleteBlocked(tenantAClient, 'recoltari', context.harvestBId!, 'tenant B recoltare')

    await assertRowHidden(tenantAClient, 'vanzari', context.saleBId!, 'tenant B vanzare')
    await assertUpdateBlocked(tenantAClient, 'vanzari', context.saleBId!, { observatii_ladite: 'cross-tenant-update-attempt' }, 'tenant B vanzare')
    await assertDeleteBlocked(tenantAClient, 'vanzari', context.saleBId!, 'tenant B vanzare')

    await assertRowHidden(tenantAClient, 'comenzi', context.orderBId!, 'tenant B comanda')
    await assertUpdateBlocked(tenantAClient, 'comenzi', context.orderBId!, { observatii: 'cross-tenant-update-attempt' }, 'tenant B comanda')
    await assertDeleteBlocked(tenantAClient, 'comenzi', context.orderBId!, 'tenant B comanda')

    await assertRowHidden(tenantAClient, 'miscari_stoc', context.stockMoveBId!, 'tenant B miscare_stoc')
    await assertUpdateBlocked(tenantAClient, 'miscari_stoc', context.stockMoveBId!, { observatii: 'cross-tenant-update-attempt' }, 'tenant B miscare_stoc')
    await assertDeleteBlocked(tenantAClient, 'miscari_stoc', context.stockMoveBId!, 'tenant B miscare_stoc')

    await assertRowHidden(tenantAClient, 'alert_dismissals', context.alertDismissalBId!, 'tenant B alert dismissal')
    await assertDeleteBlocked(tenantAClient, 'alert_dismissals', context.alertDismissalBId!, 'tenant B alert dismissal')
    await assertInsertBlocked(
      tenantAClient,
      'alert_dismissals',
      {
        tenant_id: context.tenantBId,
        user_id: userA.id,
        alert_key: `cross-tenant-alert-${context.runId}`,
      },
      'cross-tenant alert dismissal insert'
    )

    await assertRowStillExists(admin, 'clienti', context.clientBId!, 'tenant B client')
    await assertRowStillExists(admin, 'recoltari', context.harvestBId!, 'tenant B recoltare')
    await assertRowStillExists(admin, 'vanzari', context.saleBId!, 'tenant B vanzare')
    await assertRowStillExists(admin, 'comenzi', context.orderBId!, 'tenant B comanda')
    await assertRowStillExists(admin, 'miscari_stoc', context.stockMoveBId!, 'tenant B miscare_stoc')
    await assertRowStillExists(admin, 'alert_dismissals', context.alertDismissalBId!, 'tenant B alert dismissal')

    console.log('Tenant isolation: OK')
  } finally {
    if (tenantAClient) {
      await tenantAClient.auth.signOut()
    }
    if (tenantBClient) {
      await tenantBClient.auth.signOut()
    }
    await cleanup(admin, context)
  }
}

main().catch((error) => {
  console.error(
    'tenant isolation test failed:',
    error instanceof Error ? error.message : error
  )
  process.exit(1)
})
