import { describe, expect, it, vi, beforeEach } from 'vitest'

import { POST } from '@/app/api/shop/order/route'
import { __resetPublicWriteGuardForTests } from '@/lib/api/public-write-guard'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/shop/notify-farmer-shop-order', () => ({
  notifyFarmerShopOrder: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/association/public-settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/association/public-settings')>()
  return {
    ...actual,
    loadAssociationSettingsCached: vi.fn().mockResolvedValue(actual.DEFAULT_ASSOCIATION_SETTINGS),
  }
})

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

const activeProduct = {
  id: PID,
  tenant_id: TID,
  nume: 'Produs',
  unitate_vanzare: 'kg',
  pret_unitar: 10,
  association_price: 8,
  association_listed: true,
  moneda: 'RON',
  status: 'activ',
}

describe('POST /api/shop/order', () => {
  beforeEach(() => {
    insertPayloads.length = 0
    vi.clearAllMocks()
    __resetPublicWriteGuardForTests()
    getSupabaseAdmin.mockReturnValue(makeAdmin([activeProduct]))
  })

  it("channel 'association_shop' → data_origin = magazin_asociatie", async () => {
    const req = createSameOriginRequest('/api/shop/order', {
      method: 'POST',
      json: {
        channel: 'association_shop',
        tenantId: TID,
        lines: [{ produsId: PID, qty: 1 }],
        nume: 'Ion Popescu',
        telefon: '0722123456',
        locatie: 'Suceava, str. Test nr. 1',
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(insertPayloads[0]?.data_origin).toBe('magazin_asociatie')
  })

  it("channel 'farm_shop' sau lipsă → data_origin = magazin_public", async () => {
    const req1 = createSameOriginRequest('/api/shop/order', {
      method: 'POST',
      json: {
        channel: 'farm_shop',
        tenantId: TID,
        lines: [{ produsId: PID, qty: 1 }],
        nume: 'Ion Popescu',
        telefon: '0722123456',
        locatie: 'Suceava, str. Test nr. 1',
      },
    })
    insertPayloads.length = 0
    const res1 = await POST(req1)
    expect(res1.status).toBe(200)
    expect(insertPayloads[0]?.data_origin).toBe('magazin_public')

    insertPayloads.length = 0
    const req2 = createSameOriginRequest('/api/shop/order', {
      method: 'POST',
      json: {
        tenantId: TID,
        lines: [{ produsId: PID, qty: 1 }],
        nume: 'Ion Popescu',
        telefon: '0722123457',
        locatie: 'Suceava, str. Test nr. 1',
      },
    })
    const res2 = await POST(req2)
    expect(res2.status).toBe(200)
    expect(insertPayloads[0]?.data_origin).toBe('magazin_public')
  })

  it('POST cu date invalide (nume prea scurt) → 400', async () => {
    const req = createSameOriginRequest('/api/shop/order', {
      method: 'POST',
      json: {
        tenantId: TID,
        lines: [{ produsId: PID, qty: 1 }],
        nume: 'I',
        telefon: '0722123456',
        locatie: 'Suceava',
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST cu produs inexistent / indisponibil → 400', async () => {
    getSupabaseAdmin.mockReturnValue(makeAdmin([]))
    const req = createSameOriginRequest('/api/shop/order', {
      method: 'POST',
      json: {
        tenantId: TID,
        lines: [{ produsId: PID, qty: 1 }],
        nume: 'Ion Popescu',
        telefon: '0722123456',
        locatie: 'Suceava, str. Test nr. 1',
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const j = (await res.json()) as { ok: boolean; error?: string }
    expect(j.ok).toBe(false)
  })
})
