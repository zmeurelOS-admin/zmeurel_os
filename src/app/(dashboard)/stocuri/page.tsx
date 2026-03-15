import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { StocuriPageClient } from './StocuriPageClient'

export default async function StocuriPage() {
  const supabase = await createClient()
  const tenantId = await getTenantId(supabase)

  const { data: parcele = [], error } = await supabase
    .from('parcele')
    .select('id,nume_parcela')
    .eq('tenant_id', tenantId)
    .order('nume_parcela', { ascending: true })

  if (error) {
    throw new Error(`Failed to load data: ${error.message}`)
  }

  return <StocuriPageClient initialParcele={parcele ?? []} />
}
