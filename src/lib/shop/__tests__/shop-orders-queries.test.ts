import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchShopOrdersInLivrare } from '@/lib/shop/shop-orders-queries'

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    rpc: rpcMock,
  }),
}))

describe('fetchShopOrdersInLivrare', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('folosește RPC-ul tenant-aware pentru livrările zilei curente', async () => {
    const rows = [{ id: '00000000-0000-4000-8000-000000000101' }]
    rpcMock.mockResolvedValue({ data: rows, error: null })

    await expect(fetchShopOrdersInLivrare()).resolves.toEqual(rows)
    expect(rpcMock).toHaveBeenCalledWith('list_shop_orders_in_delivery_today')
  })

  it('propagă eroarea RPC', async () => {
    const error = new Error('query failed')
    rpcMock.mockResolvedValue({ data: null, error })

    await expect(fetchShopOrdersInLivrare()).rejects.toBe(error)
  })
})
