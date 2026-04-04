import { cache } from 'react'

import { getSupabaseAdmin } from '@/lib/supabase/admin'

/** `produse` nu e în tipurile generate încă — folosim client relaxat ca în `queries/produse.ts`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

/** Date minimale pentru vitrina publică (fără tenant_id în client). */
export type PublicShopProduct = {
  id: string
  nume: string
  descriere: string | null
  categorie: string
  unitate_vanzare: string
  gramaj_per_unitate: number | null
  pret_unitar: number | null
  moneda: string
  poza_1_url: string | null
  poza_2_url: string | null
  ingrediente?: string | null
  alergeni?: string | null
  conditii_pastrare?: string | null
  termen_valabilitate?: string | null
  tip_produs?: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function loadPublicShopCatalog(
  tenantId: string,
): Promise<{ farmName: string; products: PublicShopProduct[] } | null> {
  if (!UUID_RE.test(tenantId)) return null

  try {
    const admin = getSupabaseAdmin() as AnyAdmin

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('nume_ferma')
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantError || !tenant) return null

    const { data: rows, error: prodError } = await admin
      .from('produse')
      .select(
        'id,nume,descriere,categorie,unitate_vanzare,gramaj_per_unitate,pret_unitar,moneda,poza_1_url,poza_2_url,status',
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'activ')
      .order('nume', { ascending: true })

    if (prodError) {
      console.error('[loadPublicShopCatalog]', prodError)
      return null
    }

    const products = (rows ?? []) as PublicShopProduct[]

    return {
      farmName: (tenant as { nume_ferma: string }).nume_ferma,
      products,
    }
  } catch (e) {
    console.error('[loadPublicShopCatalog]', e)
    return null
  }
}

/** Aceeași cerere (metadata + page) folosește un singur fetch. */
export const loadPublicShopCatalogCached = cache(loadPublicShopCatalog)
