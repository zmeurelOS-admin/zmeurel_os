import { randomUUID } from 'node:crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

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

function makeAdmin(productRows: unknown[] | null) {
  return {
    from: (table: string) => {
      if (table === 'tenants') {
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

      if (table === 'produse') {
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

      if (table === 'comenzi') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: randomUUID(), numar_comanda_scurt: 'C-001' }, error: null }),
            }),
          }),
        }
      }

      if (table === 'message_log' || table === 'consent_events') {
        return {
          insert: async () => ({ data: null, error: null }),
        }
      }

      throw new Error(`unexpected table ${table}`)
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
  association_price: null,
  association_listed: true,
  moneda: 'RON',
  status: 'activ',
}

function buildBody(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TID,
    lines: [{ produsId: PID, qty: 1 }],
    nume: 'Ion Popescu',
    telefon: '0722123456',
    locatie: 'Suceava, str. Test nr. 1',
    ...overrides,
  }
}

function shopOrderRequest(body: Record<string, unknown>, ip = '203.0.113.10') {
  return createSameOriginRequest('/api/shop/order', {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip,
    },
    json: body,
  })
}

describe('POST /api/shop/order anti-abuse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetPublicWriteGuardForTests()
    getSupabaseAdmin.mockReturnValue(makeAdmin([activeProduct]))
  })

  it('acceptă cereri legitime sub limită', async () => {
    const first = await POST(shopOrderRequest(buildBody()))
    const second = await POST(shopOrderRequest(buildBody({ telefon: '0722123457' })))
    const third = await POST(shopOrderRequest(buildBody({ telefon: '0722123458' })))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(third.status).toBe(200)
  })

  it('returnează 429 când pragul de request-uri este depășit', async () => {
    const responses: Response[] = []
    for (let i = 0; i < 13; i++) {
      const telefon = `07220000${String(i).padStart(2, '0')}`
      responses.push(await POST(shopOrderRequest(buildBody({ telefon }))))
    }

    expect(responses.slice(0, 12).every((res) => res.status === 200)).toBe(true)
    expect(responses[12].status).toBe(429)
    expect(responses[12].headers.get('Retry-After')).toBeTruthy()
  })

  it('blochează retry agresiv pentru payload identic imediat după succes', async () => {
    const first = await POST(shopOrderRequest(buildBody()))
    const second = await POST(shopOrderRequest(buildBody()))

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    const payload = (await second.json()) as { ok: boolean; error: string }
    expect(payload.ok).toBe(false)
    expect(payload.error.toLowerCase()).toContain('comand')
  })
})
