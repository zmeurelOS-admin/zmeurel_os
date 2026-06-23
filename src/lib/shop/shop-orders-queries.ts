import { getSupabase } from '@/lib/supabase/client'
import {
  todayBucharestDate,
  type ShopOrderMilestoneReward,
  type ShopOrderRow,
} from '@/lib/shop/b2c-order-helpers'

type RewardRow = ShopOrderMilestoneReward & {
  order_id: string
}

async function attachMilestoneRewards(orders: ShopOrderRow[]): Promise<ShopOrderRow[]> {
  if (orders.length === 0) return orders

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('shop_campaign_milestone_rewards')
    .select('order_id, reward_label, status')
    .in('order_id', orders.map((order) => order.id))
    .in('status', ['pending', 'validated'])

  if (error) throw error

  const rewardByOrderId = new Map(
    ((data ?? []) as RewardRow[]).map((reward) => [reward.order_id, reward]),
  )

  return orders.map((order) => {
    const reward = rewardByOrderId.get(order.id)
    return {
      ...order,
      milestone_reward: reward
        ? {
            reward_label: reward.reward_label,
            status: reward.status,
          }
        : null,
    }
  })
}

export async function fetchShopOrders(): Promise<ShopOrderRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('shop_orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return attachMilestoneRewards((data ?? []) as ShopOrderRow[])
}

export async function fetchShopOrdersInLivrare(): Promise<ShopOrderRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('shop_orders')
    .select('*')
    .eq('status', 'in_livrare')
    .order('delivery_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return attachMilestoneRewards((data ?? []) as ShopOrderRow[])
}

export async function fetchShopOrdersScheduledToday(
  tenantId: string,
): Promise<ShopOrderRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('shop_orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('delivery_date', todayBucharestDate())
    .in('status', ['noua', 'confirmata'])
    .order('delivery_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return attachMilestoneRewards((data ?? []) as ShopOrderRow[])
}

export async function fetchShopOrdersInLivrareCount(): Promise<number> {
  const orders = await fetchShopOrdersInLivrare()
  return orders.length
}
