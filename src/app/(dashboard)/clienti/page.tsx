import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { normalizeClientTip } from '@/lib/supabase/queries/clienti'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { ClientPageClient } from './ClientPageClient'

const GOOGLE_CONTACTS_TENANT_ID = '99485d6b-f186-49db-a379-bb9a12d34968'

export const metadata = {
  title: 'Clienți | Zmeurel OS',
  description: 'Gestionează baza de clienți',
}

export default async function ClientPage() {
  const supabase = await createClient()
  const tenantId = await getTenantId(supabase)

  const { data: clienti, error } = await supabase
    .from('clienti')
    .select('id,id_client,nume_client,telefon,email,adresa,pret_negociat_lei_kg,observatii,created_at,updated_at,tenant_id,tip')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load data: ${error.message}`)
  }

  let googleSync: {
    enabled: boolean
    lastSyncAt: string | null
  } | null = null

  if (tenantId === GOOGLE_CONTACTS_TENANT_ID) {
    try {
      const admin = createServiceRoleClient()
      const { data: integration, error: integrationError } = await admin
        .from('integrations_google_contacts')
        .select('sync_enabled,last_sync_at')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      googleSync = {
        enabled: !integrationError && Boolean(integration?.sync_enabled),
        lastSyncAt: integrationError ? null : integration?.last_sync_at ?? null,
      }
    } catch {
      googleSync = { enabled: false, lastSyncAt: null }
    }
  }

  return (
    <ClientPageClient
      initialClienți={(clienti || []).map((client) => ({
        ...client,
        tip: normalizeClientTip(client.tip),
      }))}
      googleSync={googleSync}
    />
  )
}
