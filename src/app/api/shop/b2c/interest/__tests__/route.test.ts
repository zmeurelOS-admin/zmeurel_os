import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/shop/b2c/interest/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  upsertSpy: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => mocks.getSupabaseAdmin(),
}))

function buildAdmin(error: unknown = null) {
  return {
    from: (table: string) => {
      expect(table).toBe('shop_interest_list')
      return {
        upsert: async (payload: Record<string, unknown>, options: Record<string, unknown>) => {
          mocks.upsertSpy(payload, options)
          return { data: null, error }
        },
      }
    },
  }
}

describe('POST /api/shop/b2c/interest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SHOP_TENANT_ID = '22222222-2222-4222-8222-222222222222'
    mocks.getSupabaseAdmin.mockReturnValue(buildAdmin())
  })

  it('salveaza interesul cu telefon normalizat si fara duplicate', async () => {
    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/interest', {
        method: 'POST',
        json: {
          phone: '+40 722 123 456',
          name: 'Ion Popescu',
          product_name: 'Zmeură proaspătă',
        },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true })
    expect(mocks.upsertSpy).toHaveBeenCalledWith(
      {
        tenant_id: process.env.SHOP_TENANT_ID,
        phone: '722123456',
        name: 'Ion Popescu',
        product_name: 'Zmeură proaspătă',
      },
      {
        onConflict: 'tenant_id,phone,product_name',
        ignoreDuplicates: true,
      },
    )
  })

  it('raspunde ok true chiar daca persistenta esueaza', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.getSupabaseAdmin.mockReturnValue(buildAdmin({ message: 'boom' }))

    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/interest', {
        method: 'POST',
        json: {
          phone: '0722123456',
          product_name: 'Mure de câmp',
        },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true })
    expect(errorSpy).toHaveBeenCalled()
  })
})
