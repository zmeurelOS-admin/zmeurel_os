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
const getSupabaseAdmin = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

function buildAdmin(orderId = '11111111-1111-4111-8111-111111111111') {
  return {
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
    items: [
      { vid: 'v1', label: 'Mere', qty: 2, price_lei: 10 },
      { vid: 'v2', label: 'Pere', qty: 1, price_lei: 12 },
    ],
    total_lei: 32,
    notes: 'fara plastic',
  }
}

describe('POST /api/shop/b2c/order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSupabaseAdmin.mockReturnValue(buildAdmin())
    delete process.env.SHOP_TENANT_ID
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
      expect.objectContaining({ tenant_id: process.env.SHOP_TENANT_ID }),
    )
    expect(createNotificationForTenantOwner).toHaveBeenCalledWith(
      process.env.SHOP_TENANT_ID,
      'order_new',
      'Comandă nouă din magazin',
      'Ion Popescu a comandat: Mere, Pere',
      expect.objectContaining({
        channel: 'farm_shop',
        tenantId: process.env.SHOP_TENANT_ID,
        lineCount: 2,
        totalLei: 32,
      }),
      'order',
      '11111111-1111-4111-8111-111111111111',
    )
  })

  it('degradeaza gratios fara tenant: comanda merge, fara notificare', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/order', { method: 'POST', json: baseBody() }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: null }))
    expect(createNotificationForTenantOwner).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      '[shop/b2c/order] SHOP_TENANT_ID missing; created order without tenant notification',
      expect.any(Object),
    )
  })
})
