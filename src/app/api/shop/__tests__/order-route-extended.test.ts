import { describe, expect, it, vi, beforeEach } from 'vitest'

import { POST } from '@/app/api/shop/order/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const createNotificationsForAssociationAdmins = vi.fn()
const createNotificationForTenantOwner = vi.fn()
vi.mock('@/lib/notifications/create', () => ({
  createNotificationsForAssociationAdmins: (...a: unknown[]) =>
    createNotificationsForAssociationAdmins(...a),
  createNotificationForTenantOwner: (...a: unknown[]) => createNotificationForTenantOwner(...a),
  NOTIFICATION_TYPES: { order_new: 'order_new' },
}))

vi.mock('@/lib/shop/notify-farmer-shop-order', () => ({
  notifyFarmerShopOrder: vi.fn().mockResolvedValue(undefined),
}))

const TID = '990e8400-e29b-41d4-a716-446655440001'
const PID = '990e8400-e29b-41d4-a716-446655440002'

const insertPayloads: Record<string, unknown>[] = []

function makeAdmin(productRows: unknown[] | null) {
  return {
    from: (t: string) => {
      if (t === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: TID, nume_ferma: 'Ferma X', owner_user_id: 'aa000000-0000-4000-8000-000000000001' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (t === 'produse') {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({
                data: productRows,
                error: null,
              }),
            }),
          }),
        }
      }
      if (t === 'comenzi') {
        return {
          insert: (payload: Record<string, unknown>) => {
            insertPayloads.push(payload)
            return {
              select: () => ({
                single: async () => ({ data: { id: '11111111-1111-4111-8111-111111111111' }, error: null }),
              }),
            }
          },
        }
      }
      if (t === 'message_log' || t === 'consent_events') {
        return {
          insert: async () => ({ data: null, error: null }),
        }
      }
      throw new Error(`unexpected table ${t}`)
    },
  }
}

const getSupabaseAdmin = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TID,
    lines: [{ produsId: PID, qty: 2 }],
    nume: 'Ion Popescu',
    telefon: '0722123456',
    locatie: 'Suceava, str. Test nr. 1',
    ...overrides,
  }
}

describe('POST /api/shop/order — canal și preț (extended)', () => {
  beforeEach(() => {
    insertPayloads.length = 0
    vi.clearAllMocks()
  })

  it("association_shop: data_origin magazin_asociatie", async () => {
    const product = {
      id: PID,
      tenant_id: TID,
      nume: 'P',
      unitate_vanzare: 'kg',
      pret_unitar: 10,
      association_price: 8,
      association_listed: true,
      moneda: 'RON',
      status: 'activ',
    }
    getSupabaseAdmin.mockReturnValue(makeAdmin([product]))
    const res = await POST(
      createSameOriginRequest('/api/shop/order', {
        method: 'POST',
        json: baseBody({ channel: 'association_shop' }),
      }),
    )
    expect(res.status).toBe(200)
    expect(insertPayloads[0]?.data_origin).toBe('magazin_asociatie')
    expect(createNotificationsForAssociationAdmins).toHaveBeenCalled()
    expect(createNotificationForTenantOwner).not.toHaveBeenCalled()
  })

  it("farm_shop: data_origin magazin_public", async () => {
    const product = {
      id: PID,
      tenant_id: TID,
      nume: 'P',
      unitate_vanzare: 'kg',
      pret_unitar: 10,
      association_price: 5,
      association_listed: true,
      moneda: 'RON',
      status: 'activ',
    }
    getSupabaseAdmin.mockReturnValue(makeAdmin([product]))
    const res = await POST(
      createSameOriginRequest('/api/shop/order', {
        method: 'POST',
        json: baseBody({ channel: 'farm_shop' }),
      }),
    )
    expect(res.status).toBe(200)
    expect(insertPayloads[0]?.data_origin).toBe('magazin_public')
    expect(insertPayloads[0]?.pret_per_kg).toBe(10)
    expect(createNotificationForTenantOwner).toHaveBeenCalled()
  })

  it('fără channel → default farm_shop / magazin_public', async () => {
    const product = {
      id: PID,
      tenant_id: TID,
      nume: 'P',
      unitate_vanzare: 'kg',
      pret_unitar: 12,
      association_price: 7,
      association_listed: true,
      moneda: 'RON',
      status: 'activ',
    }
    getSupabaseAdmin.mockReturnValue(makeAdmin([product]))
    const res = await POST(
      createSameOriginRequest('/api/shop/order', {
        method: 'POST',
        json: baseBody(),
      }),
    )
    expect(res.status).toBe(200)
    expect(insertPayloads[0]?.data_origin).toBe('magazin_public')
    expect(insertPayloads[0]?.pret_per_kg).toBe(12)
  })

  it('association_shop: folosește association_price când există', async () => {
    const product = {
      id: PID,
      tenant_id: TID,
      nume: 'P',
      unitate_vanzare: 'kg',
      pret_unitar: 100,
      association_price: 77,
      association_listed: true,
      moneda: 'RON',
      status: 'activ',
    }
    getSupabaseAdmin.mockReturnValue(makeAdmin([product]))
    await POST(
      createSameOriginRequest('/api/shop/order', {
        method: 'POST',
        json: baseBody({ channel: 'association_shop', lines: [{ produsId: PID, qty: 1 }] }),
      }),
    )
    expect(insertPayloads[0]?.pret_per_kg).toBe(77)
    expect(insertPayloads[0]?.total).toBe(77)
  })

  it('association_shop: fără association_price → pret_unitar', async () => {
    const product = {
      id: PID,
      tenant_id: TID,
      nume: 'P',
      unitate_vanzare: 'kg',
      pret_unitar: 42,
      association_price: null,
      association_listed: true,
      moneda: 'RON',
      status: 'activ',
    }
    getSupabaseAdmin.mockReturnValue(makeAdmin([product]))
    insertPayloads.length = 0
    await POST(
      createSameOriginRequest('/api/shop/order', {
        method: 'POST',
        json: baseBody({ channel: 'association_shop', lines: [{ produsId: PID, qty: 1 }] }),
      }),
    )
    expect(insertPayloads[0]?.pret_per_kg).toBe(42)
  })

  it('farm_shop: ignoră association_price', async () => {
    const product = {
      id: PID,
      tenant_id: TID,
      nume: 'P',
      unitate_vanzare: 'kg',
      pret_unitar: 15,
      association_price: 9,
      association_listed: true,
      moneda: 'RON',
      status: 'activ',
    }
    getSupabaseAdmin.mockReturnValue(makeAdmin([product]))
    insertPayloads.length = 0
    await POST(
      createSameOriginRequest('/api/shop/order', {
        method: 'POST',
        json: baseBody({ channel: 'farm_shop', lines: [{ produsId: PID, qty: 1 }] }),
      }),
    )
    expect(insertPayloads[0]?.pret_per_kg).toBe(15)
  })

  it('association_shop + association_listed false → 400', async () => {
    const product = {
      id: PID,
      tenant_id: TID,
      nume: 'Ascuns',
      unitate_vanzare: 'kg',
      pret_unitar: 10,
      association_price: null,
      association_listed: false,
      moneda: 'RON',
      status: 'activ',
    }
    getSupabaseAdmin.mockReturnValue(makeAdmin([product]))
    const res = await POST(
      createSameOriginRequest('/api/shop/order', {
        method: 'POST',
        json: baseBody({ channel: 'association_shop' }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('produs valid + association_shop → 200', async () => {
    const product = {
      id: PID,
      tenant_id: TID,
      nume: 'P',
      unitate_vanzare: 'kg',
      pret_unitar: 10,
      association_price: null,
      association_listed: true,
      moneda: 'RON',
      status: 'activ',
    }
    getSupabaseAdmin.mockReturnValue(makeAdmin([product]))
    insertPayloads.length = 0
    const res = await POST(
      createSameOriginRequest('/api/shop/order', {
        method: 'POST',
        json: baseBody({ channel: 'association_shop' }),
      }),
    )
    expect(res.status).toBe(200)
  })
})
