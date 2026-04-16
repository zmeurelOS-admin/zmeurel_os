import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

import { createClient } from '@supabase/supabase-js'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestAdminClient, createTestUserClient, getTestEnv } from '@/tests/rls/helpers/supabase-test-client'
import type { Database } from '@/types/supabase'

type AdminClient = SupabaseClient<Database>

type TestContext = {
  admin: AdminClient
  runId: string
  emailA: string
  emailB: string
  passwordA: string
  passwordB: string
  userAId: string
  userBId: string
  tenantAId: string
  tenantBId: string
  parcelaAId: string
  produsAId: string
  comandaAId: string
  miscareStocAId: string
}

const context: TestContext = {
  admin: createTestAdminClient(),
  runId: crypto.randomUUID().slice(0, 8),
  emailA: '',
  emailB: '',
  passwordA: 'test-password-a-123',
  passwordB: 'test-password-b-123',
  userAId: '',
  userBId: '',
  tenantAId: '',
  tenantBId: '',
  parcelaAId: '',
  produsAId: '',
  comandaAId: '',
  miscareStocAId: '',
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function expectId(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing ${label} in tenant isolation setup`)
  }

  return value
}

function isPermissionDenied(error: PostgrestError | null): boolean {
  if (!error) return false
  const code = (error.code ?? '').toUpperCase()
  return code === '42501' || code === 'PGRST301'
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

async function signUpTestUser(email: string, password: string) {
  const { url, anonKey } = getTestEnv()
  const client = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
    })

    if (error) {
      throw new Error(`Failed signing up test user ${email}: ${error.message}`)
    }

    return expectId(data.user?.id, `signup id for ${email}`)
  } finally {
    await client.auth.signOut()
  }
}

async function ensureProfile(admin: AdminClient, userId: string, tenantId: string) {
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

async function insertTenantAData(admin: AdminClient) {
  const { data: parcela, error: parcelaError } = await admin
    .from('parcele')
    .insert({
      tenant_id: context.tenantAId,
      id_parcela: `RLS-P-${context.runId}`,
      nume_parcela: `Parcela tenant A ${context.runId}`,
      suprafata_m2: 100,
      an_plantare: 2024,
      status: 'Activ',
      tip_unitate: 'camp',
      tip_fruct: 'Zmeura',
    })
    .select('id')
    .single()

  if (parcelaError) {
    throw new Error(`Failed inserting tenant A parcela: ${parcelaError.message}`)
  }
  context.parcelaAId = parcela.id

  const { data: produs, error: produsError } = await admin
    .from('produse')
    .insert({
      tenant_id: context.tenantAId,
      nume: `Produs tenant A ${context.runId}`,
      categorie: 'fruct',
      unitate_vanzare: 'kg',
      pret_unitar: 10,
      status: 'inactiv',
      moneda: 'RON',
    })
    .select('id')
    .single()

  if (produsError) {
    throw new Error(`Failed inserting tenant A produs: ${produsError.message}`)
  }
  context.produsAId = produs.id

  const today = todayIso()
  const { data: comanda, error: comandaError } = await admin
    .from('comenzi')
    .insert({
      tenant_id: context.tenantAId,
      produs_id: context.produsAId,
      client_nume_manual: `Client ${context.runId}`,
      telefon: '0700000000',
      data_comanda: today,
      data_livrare: today,
      cantitate_kg: 5,
      pret_per_kg: 10,
      total: 50,
      status: 'noua',
    })
    .select('id')
    .single()

  if (comandaError) {
    throw new Error(`Failed inserting tenant A comanda: ${comandaError.message}`)
  }
  context.comandaAId = comanda.id

  const { data: miscare, error: miscareError } = await admin
    .from('miscari_stoc')
    .insert({
      tenant_id: context.tenantAId,
      locatie_id: context.parcelaAId,
      produs: 'zmeura',
      calitate: 'cal1',
      depozit: 'fresh',
      tip: 'ajustare',
      tip_miscare: 'ajustare',
      cantitate_kg: 1,
      cantitate_cal1: 1,
      cantitate_cal2: 0,
      data: today,
      observatii: `miscare tenant A ${context.runId}`,
    })
    .select('id')
    .single()

  if (miscareError) {
    throw new Error(`Failed inserting tenant A miscare_stoc: ${miscareError.message}`)
  }
  context.miscareStocAId = miscare.id
}

async function expectCrossTenantUpdateBlocked(
  table: 'parcele' | 'produse' | 'comenzi' | 'miscari_stoc' | 'profiles',
  rowId: string,
  patch: Record<string, unknown>,
  email: string,
  password: string,
) {
  const client = await createTestUserClient(email, password)

  try {
    const { data, error } = await (client as any)
      .from(table)
      .update(patch)
      .eq('id', rowId)
      .select('id')

    if (error && !isPermissionDenied(error)) {
      throw new Error(`Unexpected update error on ${table}: ${error.message}`)
    }

    expect(data ?? []).toHaveLength(0)
  } finally {
    await client.auth.signOut()
  }
}

function deleteAuthUserLocally(userId: string) {
  const sql = `delete from auth.users where id = '${userId}';`
  execFileSync('supabase', ['db', 'query', '--local', sql], {
    stdio: 'pipe',
  })
}

beforeAll(async () => {
  context.emailA = `tenant-a-test.${context.runId}@zmeurel-rls-test.local`
  context.emailB = `tenant-b-test.${context.runId}@zmeurel-rls-test.local`

  context.userAId = await signUpTestUser(context.emailA, context.passwordA)
  context.userBId = await signUpTestUser(context.emailB, context.passwordB)

  context.tenantAId = await createTenant(context.admin, context.userAId, `Tenant A RLS ${context.runId}`)
  context.tenantBId = await createTenant(context.admin, context.userBId, `Tenant B RLS ${context.runId}`)

  await ensureProfile(context.admin, context.userAId, context.tenantAId)
  await ensureProfile(context.admin, context.userBId, context.tenantBId)

  await insertTenantAData(context.admin)
})

afterAll(async () => {
  try {
    if (context.miscareStocAId) {
      await context.admin.from('miscari_stoc').delete().eq('id', context.miscareStocAId)
    }
    if (context.comandaAId) {
      await context.admin.from('comenzi').delete().eq('id', context.comandaAId)
    }
    if (context.produsAId) {
      await context.admin.from('produse').delete().eq('id', context.produsAId)
    }
    if (context.parcelaAId) {
      await context.admin.from('parcele').delete().eq('id', context.parcelaAId)
    }
    if (context.userAId) {
      await context.admin.from('profiles').delete().eq('id', context.userAId)
    }
    if (context.userBId) {
      await context.admin.from('profiles').delete().eq('id', context.userBId)
    }
    if (context.tenantAId) {
      await context.admin.from('tenants').delete().eq('id', context.tenantAId)
    }
    if (context.tenantBId) {
      await context.admin.from('tenants').delete().eq('id', context.tenantBId)
    }
  } finally {
    if (context.userAId) {
      deleteAuthUserLocally(context.userAId)
    }
    if (context.userBId) {
      deleteAuthUserLocally(context.userBId)
    }
  }
})

describe('parcele isolation', () => {
  it('tenant B nu vede parcela tenant A', async () => {
    const clientB = await createTestUserClient(context.emailB, context.passwordB)

    try {
      const { data, error } = await clientB.from('parcele').select('id,tenant_id')
      expect(error).toBeNull()
      expect(data?.find((row) => row.tenant_id === context.tenantAId)).toBeUndefined()
    } finally {
      await clientB.auth.signOut()
    }
  })

  it('tenant B nu poate modifica parcela tenant A', async () => {
    await expectCrossTenantUpdateBlocked('parcele', context.parcelaAId, { nume_parcela: 'hacked' }, context.emailB, context.passwordB)
  })
})

describe('comenzi isolation', () => {
  it('tenant B nu vede comanda tenant A', async () => {
    const clientB = await createTestUserClient(context.emailB, context.passwordB)

    try {
      const { data, error } = await clientB.from('comenzi').select('id,tenant_id')
      expect(error).toBeNull()
      expect(data?.find((row) => row.tenant_id === context.tenantAId)).toBeUndefined()
    } finally {
      await clientB.auth.signOut()
    }
  })

  it('tenant B nu poate modifica comanda tenant A', async () => {
    await expectCrossTenantUpdateBlocked('comenzi', context.comandaAId, { observatii: 'hacked' }, context.emailB, context.passwordB)
  })
})

describe('produse isolation', () => {
  it('tenant B nu vede produsul tenant A', async () => {
    const clientB = await createTestUserClient(context.emailB, context.passwordB)

    try {
      const { data, error } = await clientB.from('produse').select('id,tenant_id')
      expect(error).toBeNull()
      expect(data?.find((row) => row.tenant_id === context.tenantAId)).toBeUndefined()
    } finally {
      await clientB.auth.signOut()
    }
  })

  it('tenant B nu poate modifica produsul tenant A', async () => {
    await expectCrossTenantUpdateBlocked('produse', context.produsAId, { nume: 'hacked' }, context.emailB, context.passwordB)
  })
})

describe('miscari_stoc isolation', () => {
  it('tenant B nu vede miscarea de stoc a tenantului A', async () => {
    const clientB = await createTestUserClient(context.emailB, context.passwordB)

    try {
      const { data, error } = await clientB.from('miscari_stoc').select('id,tenant_id')
      expect(error).toBeNull()
      expect(data?.find((row) => row.tenant_id === context.tenantAId)).toBeUndefined()
    } finally {
      await clientB.auth.signOut()
    }
  })

  it('tenant B nu poate modifica miscarea de stoc a tenantului A', async () => {
    await expectCrossTenantUpdateBlocked('miscari_stoc', context.miscareStocAId, { observatii: 'hacked' }, context.emailB, context.passwordB)
  })
})

describe('profiles isolation', () => {
  it('tenant B nu vede profilul tenantului A', async () => {
    const clientB = await createTestUserClient(context.emailB, context.passwordB)

    try {
      const { data, error } = await clientB.from('profiles').select('id,tenant_id,is_superadmin')
      expect(error).toBeNull()
      expect(data?.find((row) => row.id === context.userAId)).toBeUndefined()
    } finally {
      await clientB.auth.signOut()
    }
  })

  it('tenant A nu poate seta is_superadmin = true pe propriul profil', async () => {
    const clientA = await createTestUserClient(context.emailA, context.passwordA)

    try {
      await clientA.from('profiles').update({ is_superadmin: true }).eq('id', context.userAId)

      const { data, error: verifyError } = await context.admin
        .from('profiles')
        .select('is_superadmin')
        .eq('id', context.userAId)
        .single()

      expect(verifyError).toBeNull()
      expect(data?.is_superadmin).toBe(false)
    } finally {
      await clientA.auth.signOut()
    }
  })
})
