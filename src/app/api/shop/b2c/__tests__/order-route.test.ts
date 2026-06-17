import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/shop/b2c/order/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const createNotificationForTenantOwner = vi.fn()
const upsertClientFromShopOrderMock = vi.fn()

vi.mock('@/lib/notifications/create', () => ({
  createNotificationForTenantOwner: (...args: unknown[]) => createNotificationForTenantOwner(...args),
  NOTIFICATION_TYPES: {
    order_new: 'order_new',
  },
}))

vi.mock('@/lib/shop/clienti-sync', () => ({
  upsertClientFromShopOrder: (...args: unknown[]) => upsertClientFromShopOrderMock(...args),
}))

const insertSpy = vi.fn()
const rpcSpy = vi.fn()
const getSupabaseAdmin = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

function buildAdmin(
  orderId = '11111111-1111-4111-8111-111111111111',
  preorderResult: Record<string, unknown> | null = null,
  preorderError: { message: string } | null = null,
) {
  return {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcSpy(name, args)
      return Promise.resolve({
        data: name === 'place_preorder_atomic' ? preorderResult : null,
        error: name === 'place_preorder_atomic' ? preorderError : null,
      })
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
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
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
            price_lei: 20,
          },
        ],
        total_lei: 40,
        order_kind: 'standard',
      }),
    )
    expect(createNotificationForTenantOwner).toHaveBeenCalledWith(
      process.env.SHOP_TENANT_ID,
      'order_new',
      'Comandă magazin 🍓',
      '2 caserole (1 kg) · 40 lei\nIon Popescu, 0722123456, Suceava',
      expect.objectContaining({
        channel: 'farm_shop',
        clientName: 'Ion Popescu',
        customerPhone: '0722123456',
        icon: '/shop-icon-192.png',
        items: [{ qty: 2, label: 'Zmeură — Caserolă 500 g' }],
        orderKind: 'standard',
        tenantId: process.env.SHOP_TENANT_ID,
        totalLei: 40,
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
    expect(upsertClientFromShopOrderMock).toHaveBeenCalledWith({
      tenantId: process.env.SHOP_TENANT_ID,
      phone: '0722123456',
      name: 'Ion Popescu',
      deliveryAddress: 'Suceava, str. Fermierului 10',
      deliveryCity: 'Suceava',
    })
  })

  it('folosește RPC-ul atomic pentru precomandă și returnează milestone-ul real', async () => {
    const campaignId = '21d158e1-dfa3-4db3-894b-d64ecad29b45'
    const orderId = '33333333-3333-4333-8333-333333333333'
    getSupabaseAdmin.mockReturnValue(
      buildAdmin(orderId, {
        order_id: orderId,
        order_kind: 'preorder',
        campaign_id: campaignId,
        current_count: 500,
        hit_milestone: true,
        milestone_threshold: 500,
        milestone_reward: '+2 caserole 500 g',
        reward_id: '44444444-4444-4444-8444-444444444444',
      }),
    )
    const body = {
      ...baseBody(),
      campaign_id: campaignId,
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
      preferredDeliveryDate: null,
      delivery_mode: 'ridicare',
      delivery_address: undefined,
      delivery_city: undefined,
      items: [{ ...baseBody().items[0], qty: 1 }],
    }

    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/order', { method: 'POST', json: body }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      order_id: orderId,
      total_lei: 20,
      current_count: 500,
      hit_milestone: true,
      milestone_threshold: 500,
      milestone_reward: '+2 caserole 500 g',
    })
    expect(insertSpy).not.toHaveBeenCalled()
    expect(createNotificationForTenantOwner).toHaveBeenCalledWith(
      process.env.SHOP_TENANT_ID,
      'order_new',
      'Precomandă magazin 🍓',
      '1 caserolă (0,5 kg) · 20 lei\nIon Popescu, 0722123456 — ridicare',
      expect.objectContaining({
        channel: 'farm_shop',
        icon: '/shop-icon-192.png',
        orderKind: 'preorder',
      }),
      'order',
      orderId,
    )
    expect(rpcSpy).toHaveBeenCalledWith(
      'place_preorder_atomic',
      expect.objectContaining({
        p_campaign_id: campaignId,
        p_tenant_id: process.env.SHOP_TENANT_ID,
        p_customer_phone: '0722123456',
        p_items: [
          {
            vid: 'zmeura',
            label: 'Zmeură — Caserolă 500 g',
            qty: 1,
            price_lei: 20,
          },
        ],
        p_total_lei: 20,
        p_idempotency_key: '55555555-5555-4555-8555-555555555555',
      }),
    )
    const preorderCall = rpcSpy.mock.calls.find(([name]) => name === 'place_preorder_atomic')
    expect(preorderCall?.[1]).not.toHaveProperty('p_in_suceava')
    expect(preorderCall?.[1]).toHaveProperty('p_preferred_delivery_date', null)
    expect(rpcSpy).toHaveBeenCalledWith(
      'upsert_shop_customer',
      expect.objectContaining({
        p_tenant_id: process.env.SHOP_TENANT_ID,
        p_phone: '722123456',
      }),
    )
    expect(upsertClientFromShopOrderMock).toHaveBeenCalledWith({
      tenantId: process.env.SHOP_TENANT_ID,
      phone: '0722123456',
      name: 'Ion Popescu',
      deliveryAddress: null,
      deliveryCity: null,
    })
  })

  it('trimite zona de livrare către RPC pentru precomenzi cu livrare', async () => {
    const campaignId = '21d158e1-dfa3-4db3-894b-d64ecad29b45'
    const orderId = '33333333-3333-4333-8333-333333333333'
    getSupabaseAdmin.mockReturnValue(
      buildAdmin(orderId, {
        order_id: orderId,
        current_count: 502,
        hit_milestone: false,
      }),
    )

    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/order', {
        method: 'POST',
        json: {
          ...baseBody(),
          campaign_id: campaignId,
          idempotencyKey: '55555555-5555-4555-8555-555555555555',
          deliveryZone: 'zona1',
          preferredDeliveryDate: '2026-06-20',
        },
      }),
    )

    expect(response.status).toBe(200)
    expect(rpcSpy).toHaveBeenCalledWith(
      'place_preorder_atomic',
      expect.objectContaining({
        p_idempotency_key: '55555555-5555-4555-8555-555555555555',
        p_in_suceava: true,
        p_preferred_delivery_date: '2026-06-20',
      }),
    )
  })

  it('respinge o dată preferată care nu este ISO date', async () => {
    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/order', {
        method: 'POST',
        json: {
          ...baseBody(),
          campaign_id: '21d158e1-dfa3-4db3-894b-d64ecad29b45',
          preferredDeliveryDate: '20.06.2026',
        },
      }),
    )

    expect(response.status).toBe(400)
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it('reîncearcă precomanda fără p_in_suceava când RPC-ul vechi răspunde cu minimul de livrare', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const campaignId = '21d158e1-dfa3-4db3-894b-d64ecad29b45'
    const orderId = '33333333-3333-4333-8333-333333333333'
    let preorderAttempt = 0
    getSupabaseAdmin.mockReturnValue(
      {
        rpc: (name: string, args: Record<string, unknown>) => {
          rpcSpy(name, args)
          if (name === 'place_preorder_atomic') {
            preorderAttempt += 1
            if (preorderAttempt === 1) {
              return Promise.resolve({
                data: null,
                error: {
                  message:
                    'Comanda minimă pentru livrare în Suceava este de 2 caserole (1 kg). Ai selectat 1 caserole.',
                },
              })
            }

            return Promise.resolve({
              data: {
                order_id: orderId,
                current_count: 501,
                hit_milestone: false,
              },
              error: null,
            })
          }

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
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        },
      },
    )

    const response = await POST(
      createSameOriginRequest('/api/shop/b2c/order', {
        method: 'POST',
        json: {
          ...baseBody(),
          campaign_id: campaignId,
          deliveryZone: 'zona1',
          items: [{ ...baseBody().items[0], qty: 1 }],
        },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      order_id: orderId,
      total_lei: 20,
      current_count: 501,
      hit_milestone: false,
      milestone_threshold: null,
      milestone_reward: null,
    })
    expect(
      rpcSpy.mock.calls.filter(([name]) => name === 'place_preorder_atomic'),
    ).toHaveLength(2)
    expect(rpcSpy.mock.calls[0]?.[1]).toMatchObject({
      p_campaign_id: campaignId,
      p_in_suceava: true,
    })
    expect(rpcSpy.mock.calls[1]?.[1]).toMatchObject({
      p_campaign_id: campaignId,
      p_in_suceava: null,
    })
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
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
