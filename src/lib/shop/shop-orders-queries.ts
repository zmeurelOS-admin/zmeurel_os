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
  const { data, error } = await supabase
    .from('shop_orders')
    .select('*')
    .eq('status', 'in_livrare')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as ShopOrderRow[]
}

export async function fetchShopOrdersInLivrareCount(): Promise<number> {
  const supabase = getSupabase()
  const { count, error } = await supabase
    .from('shop_orders')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'in_livrare')

  if (error) throw error
  return count ?? 0
}
