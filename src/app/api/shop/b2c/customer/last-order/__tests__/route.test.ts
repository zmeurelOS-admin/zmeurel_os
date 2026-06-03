import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/api/shop/b2c/customer/last-order/route'
import { __resetPublicWriteGuardForTests } from '@/lib/api/public-write-guard'

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  eqSpy: vi.fn(),
  orSpy: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => mocks.getSupabaseAdmin(),
}))

function request(phone: string, ip = '203.0.113.25') {
  return new Request(`http://localhost:3000/api/shop/b2c/customer/last-order?phone=${encodeURIComponent(phone)}`, {
    headers: {
      'x-forwarded-for': ip,
    },
  })
}

function buildAdmin(row: Record<string, unknown> | null) {
  return {
    from: (table: string) => {
      expect(table).toBe('shop_orders')
      return {
        select: (columns: string) => {
          expect(columns).toBe('items,total_lei,created_at')
          return {
            eq: (column: string, value: string) => {
              mocks.eqSpy(column, value)
              return {
                or: (filter: string) => {
                  mocks.orSpy(filter)
                  return {
                    order: (column: string, options: Record<string, unknown>) => {
                      expect(column).toBe('created_at')
                      expect(options).toEqual({ ascending: false })
                      return {
                        limit: (count: number) => {
                          expect(count).toBe(1)
                          return {
                            maybeSingle: async () => ({ data: row, error: null }),
                          }
                        },
                      }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }
}

describe('GET /api/shop/b2c/customer/last-order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetPublicWriteGuardForTests()
    process.env.SHOP_TENANT_ID = '22222222-2222-4222-8222-222222222222'
  })

  it('returneaza ultima comanda fara date personale', async () => {
    mocks.getSupabaseAdmin.mockReturnValue(
      buildAdmin({
        items: [
          { vid: 'afine-500', label: 'Afine siberiene — Caserolă 500 g', qty: 2, price_lei: 15 },
        ],
        total_lei: 30,
        created_at: '2026-06-03T10:00:00Z',
      }),
    )

    const response = await GET(request('+40 722 123 456'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      found: true,
      items: [
        {
          product_id: 'afine-500',
          name: 'Afine siberiene',
          quantity: 2,
          unit_label: 'Caserolă 500 g',
          price_lei: 15,
        },
      ],
      total_lei: 30,
      created_at: '2026-06-03T10:00:00Z',
    })
    expect(payload.delivery_address).toBeUndefined()
    expect(payload.email).toBeUndefined()
    expect(mocks.eqSpy).toHaveBeenCalledWith('tenant_id', process.env.SHOP_TENANT_ID)
    expect(mocks.orSpy).toHaveBeenCalledWith(
      'customer_phone.eq.722123456,customer_phone.eq.0722123456,customer_phone.eq.40722123456',
    )
  })

  it('returneaza found false pentru client fara comenzi', async () => {
    mocks.getSupabaseAdmin.mockReturnValue(buildAdmin(null))

    const response = await GET(request('0722123456'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ found: false })
  })
})
