import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { ClientPageClient } from './ClientPageClient'

export const metadata = {
  title: 'Clienți | Zmeurel OS',
  description: 'Gestionează baza de clienți',
}

export default async function ClientPage() {
  const supabase = await createClient()
  const tenantId = await getTenantId(supabase)

  const { data: clienti, error } = await supabase
    .from('clienti')
    .select('id,id_client,nume_client,telefon,email,adresa,pret_negociat_lei_kg,observatii,created_at,updated_at,tenant_id')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to load data: ${error.message}`)
  }

  return <ClientPageClient initialClienți={clienti || []} />
}
