import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type CheckoutProvisionedData = {
  tenantId: string
  produsId: string
  cleanup: () => Promise<void>
}

function requireEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`[checkout-e2e] Missing required env var: ${name}`)
  }
  return value
}

function createAdminClient(): SupabaseClient {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

export async function provisionCheckoutTestData(): Promise<CheckoutProvisionedData> {
  const admin = createAdminClient()
  const ownerUserId = randomUUID()

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({
      owner_user_id: ownerUserId,
      nume_ferma: 'Test Ferma E2E',
      plan: 'freemium',
      is_association_approved: true,
    })
    .select('id')
    .single()

  if (tenantError || !tenant?.id) {
    throw new Error(`[checkout-e2e] Failed to create tenant: ${tenantError?.message || 'unknown error'}`)
  }

  const tenantId = tenant.id

  const { error: legalDocsError } = await admin.from('farmer_legal_docs').insert({
    tenant_id: tenantId,
    full_name: 'Test Farmer E2E',
    legal_type: 'certificat_producator',
    certificate_series: 'SV',
    certificate_number: 'E2E-0001',
    certificate_expiry: '2027-12-31',
    locality: 'Suceava',
    phone: '0722000001',
    certificate_photo_url: 'legal-docs/test-farmer-e2e/certificat.jpg',
    legal_accepted_at: new Date().toISOString(),
  })

  if (legalDocsError) {
    await admin.from('tenants').delete().eq('id', tenantId)
    throw new Error(
      `[checkout-e2e] Failed to create farmer_legal_docs for tenant ${tenantId}: ${legalDocsError.message}`,
    )
  }

  const { data: product, error: productError } = await admin
    .from('produse')
    .insert({
      tenant_id: tenantId,
      nume: 'Zmeură test E2E',
      categorie: 'fruct',
      unitate_vanzare: 'kg',
      pret_unitar: 15,
      status: 'activ',
      association_listed: true,
      association_price: 15,
      association_category: 'fructe_legume',
      moneda: 'RON',
    })
    .select('id')
    .single()

  if (productError || !product?.id) {
    await admin.from('farmer_legal_docs').delete().eq('tenant_id', tenantId)
    await admin.from('tenants').delete().eq('id', tenantId)
    throw new Error(
      `[checkout-e2e] Failed to create public association product for tenant ${tenantId}: ${
        productError?.message || 'unknown error'
      }`,
    )
  }

  const produsId = product.id

  return {
    tenantId,
    produsId,
    cleanup: async () => {
      await admin.from('produse').delete().eq('id', produsId)
      await admin.from('farmer_legal_docs').delete().eq('tenant_id', tenantId)
      await admin.from('tenants').delete().eq('id', tenantId)
    },
  }
}

export async function cleanupCheckoutOrder(orderId: string): Promise<void> {
  const admin = createAdminClient()

  await admin.from('message_log').delete().eq('order_id', orderId)
  await admin.from('consent_events').delete().eq('order_id', orderId)
  await admin.from('comenzi').delete().eq('id', orderId)
}
