import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchShopOrders,
  fetchShopOrdersInLivrare,
} from '@/lib/shop/shop-orders-queries'

const {
  fromMock,
  ordersOrderMock,
  rewardsOrderIdsInMock,
  rewardsStatusInMock,
  rpcMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  ordersOrderMock: vi.fn(),
  rewardsOrderIdsInMock: vi.fn(),
  rewardsStatusInMock: vi.fn(),
  rpcMock: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}))

const orderId = '00000000-0000-4000-8000-000000000101'
const order = { id: orderId }

describe('shop order queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockImplementation((table: string) => {
      if (table === 'shop_orders') {
        return {
          select: vi.fn(() => ({
            order: ordersOrderMock,
          })),
        }
      }

      if (table === 'shop_campaign_milestone_rewards') {
        return {
          select: vi.fn(() => ({
            in: rewardsOrderIdsInMock,
          })),
        }
      }

      throw new Error(`unexpected table ${table}`)
    })
    rewardsOrderIdsInMock.mockReturnValue({ in: rewardsStatusInMock })
    rewardsStatusInMock.mockResolvedValue({ data: [], error: null })
  })

  it('atașează reward-ul activ comenzilor din lista generală', async () => {
    ordersOrderMock.mockResolvedValue({ data: [order], error: null })
    rewardsStatusInMock.mockResolvedValue({
      data: [
        {
          order_id: orderId,
          reward_label: 'O caserolă bonus',
          status: 'pending',
        },
      ],
      error: null,
    })

    await expect(fetchShopOrders()).resolves.toEqual([
      {
        ...order,
        milestone_reward: {
          reward_label: 'O caserolă bonus',
          status: 'pending',
        },
      },
    ])
    expect(rewardsOrderIdsInMock).toHaveBeenCalledWith('order_id', [orderId])
    expect(rewardsStatusInMock).toHaveBeenCalledWith('status', ['pending', 'validated'])
  })

  it('folosește RPC-ul tenant-aware și atașează reward-ul în livrările zilei', async () => {
    rpcMock.mockResolvedValue({ data: [order], error: null })
    rewardsStatusInMock.mockResolvedValue({
      data: [
        {
          order_id: orderId,
          reward_label: 'O caserolă bonus',
          status: 'validated',
        },
      ],
      error: null,
    })

    await expect(fetchShopOrdersInLivrare()).resolves.toEqual([
      {
        ...order,
        milestone_reward: {
          reward_label: 'O caserolă bonus',
          status: 'validated',
        },
      },
    ])
    expect(rpcMock).toHaveBeenCalledWith('list_shop_orders_in_delivery_today')
  })

  it('propagă eroarea RPC înainte de query-ul rewards', async () => {
    const error = new Error('query failed')
    rpcMock.mockResolvedValue({ data: null, error })

    await expect(fetchShopOrdersInLivrare()).rejects.toBe(error)
    expect(fromMock).not.toHaveBeenCalled()
  })
})
