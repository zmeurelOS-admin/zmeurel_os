import { getSupabase } from '@/lib/supabase/client'
import type { ShopOrderRow } from '@/lib/shop/b2c-order-helpers'

export async function fetchShopOrders(): Promise<ShopOrderRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('shop_orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ShopOrderRow[]
}

export async function fetchShopOrdersInLivrare(): Promise<ShopOrderRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('list_shop_orders_in_delivery_today')

  if (error) throw error
  return (data ?? []) as ShopOrderRow[]
}

export async function fetchShopOrdersInLivrareCount(): Promise<number> {
  const orders = await fetchShopOrdersInLivrare()
  return orders.length
}
