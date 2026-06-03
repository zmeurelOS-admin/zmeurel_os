import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PATCH } from '@/app/api/shop/b2c/customer/source/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  rpcSpy: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => mocks.getSupabaseAdmin(),
}))

function buildAdmin(error: unknown = null) {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      mocks.rpcSpy(name, args)
      return { data: true, error }
    },
  }
}

describe('PATCH /api/shop/b2c/customer/source', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SHOP_TENANT_ID = '22222222-2222-4222-8222-222222222222'
    mocks.getSupabaseAdmin.mockReturnValue(buildAdmin())
  })

  it('salveaza prima sursa prin RPC controlat', async () => {
    const response = await PATCH(
      createSameOriginRequest('/api/shop/b2c/customer/source', {
        method: 'PATCH',
        json: {
          phone: '+40 722 123 456',
          source: 'instagram',
        },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true })
    expect(mocks.rpcSpy).toHaveBeenCalledWith('set_shop_customer_acquisition_source_once', {
      p_tenant_id: process.env.SHOP_TENANT_ID,
      p_phone: '722123456',
      p_source: 'instagram',
    })
  })

  it('respinge surse necunoscute', async () => {
    const response = await PATCH(
      createSameOriginRequest('/api/shop/b2c/customer/source', {
        method: 'PATCH',
        json: {
          phone: '0722123456',
          source: 'newsletter',
        },
      }),
    )

    expect(response.status).toBe(400)
    expect(mocks.rpcSpy).not.toHaveBeenCalled()
  })
})
