import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/shop/b2c/orders/reorder/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const { getUserMock, rpcMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: getUserMock,
    },
    rpc: rpcMock,
  }),
}))

const orderIds = [
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
]

describe('POST /api/shop/b2c/orders/reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
    })
    rpcMock.mockResolvedValue({ data: orderIds.length, error: null })
  })

  it('trimite lista ordonată către RPC-ul tranzacțional', async () => {
    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/orders/reorder', {
        method: 'POST',
        json: { order_ids: orderIds },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      updated_count: orderIds.length,
    })
    expect(rpcMock).toHaveBeenCalledWith('reorder_shop_deliveries_today', {
      p_order_ids: orderIds,
    })
  })

  it('respinge duplicatele înainte de RPC', async () => {
    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/orders/reorder', {
        method: 'POST',
        json: { order_ids: [orderIds[0], orderIds[0]] },
      }),
    )

    expect(response.status).toBe(400)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('respinge cererea fără utilizator autentificat', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/orders/reorder', {
        method: 'POST',
        json: { order_ids: orderIds },
      }),
    )

    expect(response.status).toBe(401)
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
