import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/api/shop/b2c/customer/route'
import { __resetPublicWriteGuardForTests } from '@/lib/api/public-write-guard'

const mocks = vi.hoisted(() => ({
  lookupShopCustomer: vi.fn(),
}))

vi.mock('@/lib/shop/b2c-customers', () => ({
  lookupShopCustomer: (...args: unknown[]) => mocks.lookupShopCustomer(...args),
}))

function request(phone: string, ip = '203.0.113.20') {
  return new Request(`http://localhost:3000/api/shop/b2c/customer?phone=${encodeURIComponent(phone)}`, {
    headers: {
      'x-forwarded-for': ip,
    },
  })
}

describe('GET /api/shop/b2c/customer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetPublicWriteGuardForTests()
    process.env.SHOP_TENANT_ID = '22222222-2222-4222-8222-222222222222'
  })

  it('returneaza datele public-safe pentru client gasit', async () => {
    mocks.lookupShopCustomer.mockResolvedValue({
      found: true,
      name: 'Ion Popescu',
      delivery_address: 'Str. Fermierului 10',
      delivery_city: 'Suceava',
      delivery_mode: 'livrare',
    })

    const response = await GET(request('0722 123 456'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      found: true,
      name: 'Ion Popescu',
      delivery_address: 'Str. Fermierului 10',
      delivery_city: 'Suceava',
      delivery_mode: 'livrare',
    })
    expect(payload.customer_id).toBeUndefined()
    expect(payload.email).toBeUndefined()
    expect(mocks.lookupShopCustomer).toHaveBeenCalledWith({
      tenantId: process.env.SHOP_TENANT_ID,
      phone: '0722123456',
    })
  })

  it('returneaza found false cand clientul lipseste', async () => {
    mocks.lookupShopCustomer.mockResolvedValue({ found: false })

    const response = await GET(request('0722123456'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ found: false })
  })

  it('limiteaza lookup-ul la 5 cereri pe minut per IP', async () => {
    mocks.lookupShopCustomer.mockResolvedValue({ found: false })

    const responses: Response[] = []
    for (let i = 0; i < 6; i += 1) {
      responses.push(await GET(request(`07221234${50 + i}`)))
    }

    expect(responses.slice(0, 5).every((response) => response.status === 200)).toBe(true)
    expect(responses[5].status).toBe(429)
    expect(responses[5].headers.get('Retry-After')).toBeTruthy()
  })
})
