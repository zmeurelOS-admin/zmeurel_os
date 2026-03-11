// src/app/(dashboard)/vanzari-butasi/page.tsx

import { createClient } from '@/lib/supabase/server'
import { VanzariButasiPageClient } from './VanzariButasiPageClient'
import type { VanzareButasi } from '@/lib/supabase/queries/vanzari-butasi'

export default async function VanzariButasiPage() {
  const supabase = await createClient()

  // RLS handles tenant isolation automatically - no manual auth check needed (middleware handles it)
  const { data: vanzariButasi } = await supabase
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
    .order('data_comanda', { ascending: false })

  const { data: clienti } = await supabase
    .from('clienti')
    .select('id, id_client, nume_client, telefon')

  const { data: parcele } = await supabase
    .from('parcele')
    .select('id, id_parcela, nume_parcela')

  // Type-safe fallback pentru null
  const safeVanzari: VanzareButasi[] = (vanzariButasi ?? []) as unknown as VanzareButasi[]
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

