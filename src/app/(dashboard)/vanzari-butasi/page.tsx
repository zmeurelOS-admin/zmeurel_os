// src/app/(dashboard)/vanzari-butasi/page.tsx

import { createClient } from '@/lib/supabase/server'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'
import { VanzariButasiPageClient } from './VanzariButasiPageClient'
import type { VanzareButasi } from '@/lib/supabase/queries/vanzari-butasi'

export default async function VanzariButasiPage() {
  const supabase = await createClient()
  const tenantId = await getTenantIdOrNull(supabase)

  if (!tenantId) {
    return (
      <VanzariButasiPageClient
        initialVanzari={[]}
        clienti={[]}
        parcele={[]}
      />
    )
  }

  const { data: vanzariButasi, error: vanzariError } = await supabase
    .from('vanzari_butasi')
    .select(`
      id,
      id_vanzare_butasi,
      data,
      data_comanda,
      data_livrare_estimata,
      status,
      client_id,
      client_nume_manual,
      parcela_sursa_id,
      adresa_livrare,
      avans_suma,
      avans_data,
      total_lei,
      soi_butasi,
      cantitate_butasi,
      pret_unitar_lei,
      observatii,
      created_at,
      updated_at,
      tenant_id,
      vanzari_butasi_items (
        id,
        tenant_id,
        comanda_id,
        soi,
        cantitate,
        pret_unitar,
        subtotal,
        created_at
      )
    `)
    .eq('tenant_id', tenantId)
    .order('data_comanda', { ascending: false })

  if (vanzariError) {
    console.error('[vanzari-butasi] load error:', vanzariError.message)
  }

  const { data: clienti, error: clientiError } = await supabase
    .from('clienti')
    .select('id, id_client, nume_client, telefon')
    .eq('tenant_id', tenantId)

  if (clientiError) {
    console.error('[vanzari-butasi] clienti error:', clientiError.message)
  }

  const { data: parcele, error: parceleError } = await supabase
    .from('parcele')
    .select('id, id_parcela, nume_parcela')
    .eq('tenant_id', tenantId)

  if (parceleError) {
    console.error('[vanzari-butasi] parcele error:', parceleError.message)
  }

  // Map raw Supabase rows: nested join comes back as `vanzari_butasi_items`, component expects `items`
  const safeVanzari: VanzareButasi[] = (vanzariButasi ?? []).map((row) => ({
    ...(row as unknown as VanzareButasi),
    items: (row as unknown as { vanzari_butasi_items?: VanzareButasi['items'] }).vanzari_butasi_items ?? [],
  }))
  const safeClienți = clienti ?? []
  const safeParcele = parcele ?? []

  return (
    <VanzariButasiPageClient
      initialVanzari={safeVanzari}
      clienti={safeClienți}
      parcele={safeParcele}
    />
  )
}
