import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/shop/b2c/check-recent-order/route'
import { __resetPublicWriteGuardForTests } from '@/lib/api/public-write-guard'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const rpcSpy = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    rpc: (name: string, args: Record<string, unknown>) => rpcSpy(name, args),
  }),
}))

function request(phone = '0722 123 456', ip = '203.0.113.30') {
  return createSameOriginRequest('/api/shop/b2c/check-recent-order', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    json: {
      phone,
      campaignId: '21d158e1-dfa3-4db3-894b-d64ecad29b45',
    },
  })
}

describe('POST /api/shop/b2c/check-recent-order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetPublicWriteGuardForTests()
    process.env.SHOP_TENANT_ID = '22222222-2222-4222-8222-222222222222'
  })

  it('normalizează telefonul și returnează răspunsul RPC', async () => {
    const result = {
      found: true,
      order_id: '33333333-3333-4333-8333-333333333333',
      created_at: '2026-06-13T10:00:00.000Z',
      minutes_ago: 4.4,
      items: [{ qty: 2, vid: 'zmeura', label: 'Zmeură — Caserolă 500 g', price_lei: 20 }],
      total_lei: 40,
      order_kind: 'preorder',
    }
    rpcSpy.mockResolvedValue({ data: result, error: null })

    const response = await POST(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(result)
    expect(rpcSpy).toHaveBeenCalledWith('check_recent_shop_order', {
      p_tenant_id: process.env.SHOP_TENANT_ID,
      p_customer_phone: '0722123456',
      p_campaign_id: '21d158e1-dfa3-4db3-894b-d64ecad29b45',
      p_minutes: 10,
    })
  })

  it('respinge telefonul invalid fără apel RPC', async () => {
    const response = await POST(request('123'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      found: false,
      error: 'Introdu un număr de telefon valid (07xxxxxxxx)',
    })
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it('limitează verificarea la 5 cereri pe minut per IP', async () => {
    rpcSpy.mockResolvedValue({ data: { found: false }, error: null })

    const responses: Response[] = []
    for (let index = 0; index < 6; index += 1) {
      responses.push(await POST(request(`07221234${50 + index}`)))
    }

    expect(responses.slice(0, 5).every((response) => response.status === 200)).toBe(true)
    expect(responses[5].status).toBe(429)
    expect(responses[5].headers.get('Retry-After')).toBeTruthy()
  })
})
