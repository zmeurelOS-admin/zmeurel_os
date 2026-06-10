import { getSupabase } from '@/lib/supabase/client'
import type {
  ShopOrderMilestoneReward,
  ShopOrderRow,
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
  const { data, error } = await supabase.rpc('list_shop_orders_in_delivery_today')

  if (error) throw error
  return attachMilestoneRewards((data ?? []) as ShopOrderRow[])
}

export async function fetchShopOrdersInLivrareCount(): Promise<number> {
  const orders = await fetchShopOrdersInLivrare()
  return orders.length
}
