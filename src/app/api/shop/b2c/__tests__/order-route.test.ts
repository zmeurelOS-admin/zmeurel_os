import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/shop/b2c/order/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const createNotificationForTenantOwner = vi.fn()

vi.mock('@/lib/notifications/create', () => ({
  createNotificationForTenantOwner: (...args: unknown[]) => createNotificationForTenantOwner(...args),
  NOTIFICATION_TYPES: {
    order_new: 'order_new',
  },
}))

const insertSpy = vi.fn()
const rpcSpy = vi.fn()
const getSupabaseAdmin = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

function buildAdmin(orderId = '11111111-1111-4111-8111-111111111111') {
  return {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcSpy(name, args)
      return Promise.resolve({ data: null, error: null })
    },
    from: (table: string) => {
      if (table !== 'shop_orders') throw new Error(`unexpected table ${table}`)
      return {
        insert: (payload: Record<string, unknown>) => {
          insertSpy(payload)
          return {
            select: () => ({
              single: async () => ({
                data: { id: orderId },
                error: null,
              }),
            }),
          }
        },
      }
    },
  }
}

function baseBody() {
  return {
    customer_name: 'Ion Popescu',
    customer_phone: '0722123456',
    delivery_mode: 'livrare',
    delivery_address: 'Suceava, str. Fermierului 10',
    delivery_city: 'Suceava',
    items: [
      { vid: 'zmeura', label: 'Zmeură — Caserolă 500 g', qty: 2, price_lei: 999 },
    ],
    total_lei: 999,
    notes: 'fara plastic',
  }
}

describe('POST /api/shop/b2c/order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSupabaseAdmin.mockReturnValue(buildAdmin())
    process.env.SHOP_TENANT_ID = '22222222-2222-4222-8222-222222222222'
  })

  it('insereaza cu tenant_id si creeaza notificare cand SHOP_TENANT_ID este setat', async () => {
    process.env.SHOP_TENANT_ID = '22222222-2222-4222-8222-222222222222'

    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/order', { method: 'POST', json: baseBody() }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: process.env.SHOP_TENANT_ID,
        customer_phone: '0722123456',
        items: [
          {
            vid: 'zmeura',
            label: 'Zmeură — Caserolă 500 g',
            qty: 2,
            price_lei: 18,
          },
        ],
        total_lei: 35,
      }),
    )
    expect(createNotificationForTenantOwner).toHaveBeenCalledWith(
      process.env.SHOP_TENANT_ID,
      'order_new',
      'Comandă nouă din magazin',
      'Ion Popescu a comandat: Zmeură — Caserolă 500 g',
      expect.objectContaining({
        channel: 'farm_shop',
        tenantId: process.env.SHOP_TENANT_ID,
        lineCount: 1,
        totalLei: 35,
      }),
      'order',
      '11111111-1111-4111-8111-111111111111',
    )
    expect(rpcSpy).toHaveBeenCalledWith(
      'upsert_shop_customer',
      expect.objectContaining({
        p_tenant_id: process.env.SHOP_TENANT_ID,
        p_phone: '722123456',
        p_name: 'Ion Popescu',
        p_default_delivery_address: 'Suceava, str. Fermierului 10',
        p_default_delivery_city: 'Suceava',
        p_default_delivery_mode: 'livrare',
      }),
    )
  })

  it.each([undefined, '', '   '])(
    'respinge comanda fără SHOP_TENANT_ID valid înainte de insert (%s)',
    async (configuredTenantId) => {
      if (configuredTenantId === undefined) {
        delete process.env.SHOP_TENANT_ID
      } else {
        process.env.SHOP_TENANT_ID = configuredTenantId
      }
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

      const response = await POST(
        createSameOriginRequest('/api/shop/b2c/order', { method: 'POST', json: baseBody() }),
      )
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(payload).toEqual({
        success: false,
        error: 'Magazinul nu este configurat pentru preluarea comenzilor.',
      })
      expect(insertSpy).not.toHaveBeenCalled()
      expect(createNotificationForTenantOwner).not.toHaveBeenCalled()
      expect(rpcSpy).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith(
        '[shop/b2c/order] SHOP_TENANT_ID missing; order rejected',
      )
      errorSpy.mockRestore()
    },
  )

  it('respinge orice produs diferit de zmeura', async () => {
    const body = baseBody()
    body.items[0] = { vid: 'afine-500', label: 'Afine 500 g', qty: 2, price_lei: 18 }

    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/order', { method: 'POST', json: body }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Magazinul acceptă momentan doar comenzi de zmeură.',
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('respinge o cantitate fracționară', async () => {
    const body = baseBody()
    body.items[0].qty = 1.5

    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/order', { method: 'POST', json: body }),
    )

    expect(response.status).toBe(400)
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('respinge un telefon care nu este număr mobil românesc', async () => {
    const body = baseBody()
    body.customer_phone = '0622123456'

    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/order', { method: 'POST', json: body }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Introdu un număr de telefon valid (07xxxxxxxx)',
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })
})
