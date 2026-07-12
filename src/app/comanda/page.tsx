import { getSupabaseAdmin } from '@/lib/supabase/admin'

import { ShopClient, type ComandaShopProduct } from './ShopClient'

export const dynamic = 'force-dynamic'

function mapRow(row: {
  id: string
  name: string
  description: string | null
  unit_label: string | null
  price_lei: number | null
  bulk_threshold_kg?: number | null
  bulk_price_lei?: number | null
  available: boolean
  sort_order: number
}): ComandaShopProduct {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    unit_label: row.unit_label ?? 'Caserolă',
    price_lei: row.price_lei,
    bulk_threshold_kg: row.bulk_threshold_kg ?? null,
    bulk_price_lei: row.bulk_price_lei ?? null,
    available: row.available,
    sort_order: row.sort_order,
  }
}

export default async function ComandaPage() {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('shop_products')
    .select('id, name, description, unit_label, price_lei, bulk_threshold_kg, bulk_price_lei, available, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[comanda/page] failed to load shop_products', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
  }

  const products = (data ?? []).map(mapRow)

  return <ShopClient products={products} loadError={error ? 'Nu am putut încărca produsele.' : null} />
}
