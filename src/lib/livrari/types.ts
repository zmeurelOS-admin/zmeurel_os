import type { Json } from '@/types/supabase'
import type { ShopOrderRow } from '@/lib/shop/b2c-order-helpers'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

export type DeliveryItemSource = 'shop_order' | 'comanda_manuala'

export type DeliveryItem = {
  id: string
  source: DeliveryItemSource
  clientTip?: 'standard' | 'patiserie' | 'magazin'
  customer_name: string
  customer_phone: string | null
  delivery_address: string | null
  delivery_date: string | null
  delivery_position: number | null
  cantitate_kg: number | null
  total_lei: number
  notes: string | null
  items: Json | null
  milestone_reward: ShopOrderRow['milestone_reward'] | null
  status: string
  created_at: string
  _shopOrder?: ShopOrderRow
  _comanda?: Comanda
}

export function normalizeShopOrder(o: ShopOrderRow): DeliveryItem {
  return {
    id: o.id,
    source: 'shop_order',
    clientTip: 'standard',
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    delivery_address: o.delivery_address ?? null,
    delivery_date: o.delivery_date ?? null,
    delivery_position: o.delivery_position ?? null,
    cantitate_kg: Array.isArray(o.items)
      ? (o.items as Array<{ qty?: number }>).reduce(
          (sum, item) => sum + (item.qty ?? 0) * 0.5,
          0,
        )
      : null,
    total_lei: o.total_lei,
    notes: o.notes ?? null,
    items: o.items,
    milestone_reward: o.milestone_reward ?? null,
    status: o.status,
    created_at: o.created_at,
    _shopOrder: o,
  }
}

export function normalizeComanda(
  c: Comanda,
  clientTip?: 'standard' | 'patiserie' | 'magazin',
): DeliveryItem {
  return {
    id: c.id,
    source: 'comanda_manuala',
    clientTip: clientTip ?? 'standard',
    customer_name: c.client_nume_manual ?? c.client_nume ?? 'Client necunoscut',
    customer_phone: c.telefon ?? null,
    delivery_address: c.locatie_livrare ?? null,
    delivery_date: c.data_livrare ?? null,
    delivery_position: null,
    cantitate_kg: c.cantitate_kg,
    total_lei: Number(c.total ?? 0),
    notes: c.observatii ?? null,
    items: null,
    milestone_reward: null,
    status: c.status,
    created_at: c.created_at,
    _comanda: c,
  }
}
