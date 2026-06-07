import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PATCH } from '@/app/api/shop/b2c/orders/[id]/route'
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

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: vi.fn(),
}))

const orderId = '00000000-0000-4000-8000-000000000101'

function deliverRequest() {
  return PATCH(
    createSameOriginRequest(`/api/shop/b2c/orders/${orderId}`, {
      method: 'PATCH',
      json: { status: 'livrata' },
    }),
    { params: Promise.resolve({ id: orderId }) },
  )
}

describe('PATCH /api/shop/b2c/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
    })
    rpcMock.mockResolvedValue({
      data: {
        already_delivered: false,
        shop_order_id: orderId,
        total_kg: 1,
        total_lei: 30,
      },
      error: null,
    })
  })

  it('marchează livrarea prin bridge-ul ERP atomic cu plata achitată', async () => {
    const response = await deliverRequest()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      delivery: {
        already_delivered: false,
        shop_order_id: orderId,
      },
    })
    expect(rpcMock).toHaveBeenCalledWith('deliver_shop_order_atomic', {
      p_shop_order_id: orderId,
      p_payment_status: 'platit',
    })
  })

  it('tratează retry-ul idempotent ca succes fără alt flux în endpoint', async () => {
    rpcMock.mockResolvedValue({
      data: {
        already_delivered: true,
        shop_order_id: orderId,
        comanda_id: '00000000-0000-4000-8000-000000000201',
      },
      error: null,
    })

    const response = await deliverRequest()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      delivery: { already_delivered: true },
    })
    expect(rpcMock).toHaveBeenCalledTimes(1)
  })

  it('propagă eroarea exactă atunci când stocul este insuficient', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Stoc insuficient pentru livrare.' },
    })

    const response = await deliverRequest()

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Stoc insuficient pentru livrare.',
    })
  })

  it('propagă eroarea exactă atunci când lipsește greutatea produsului', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Produsul Zmeură — Caserolă 500 g nu are greutate configurată.' },
    })

    const response = await deliverRequest()

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Produsul Zmeură — Caserolă 500 g nu are greutate configurată.',
    })
  })
})
