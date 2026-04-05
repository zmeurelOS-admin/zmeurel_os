import { describe, expect, it, vi, beforeEach } from 'vitest'

import { PATCH } from '@/app/api/association/orders/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const getAssociationRole = vi.fn()
vi.mock('@/lib/association/auth', () => ({
  getAssociationRole: (uid: string) => getAssociationRole(uid),
}))

const OID = '880e8400-e29b-41d4-a716-446655440001'
const UID = '880e8400-e29b-41d4-a716-446655440002'

const orderMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => orderMocks.createClient(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => orderMocks.getSupabaseAdmin(),
}))

function buildOrdersApi(opts: {
  user: { id: string } | null
  fetchData: {
    id: string
    data_origin: string | null
    tenant_id?: string | null
    status?: string
    telefon?: string | null
    data_comanda?: string
    client_nume_manual?: string | null
    locatie_livrare?: string | null
    note_interne?: string | null
  } | null
  fetchError?: unknown
  updateData: { id: string }[] | null
  updateError?: unknown
}) {
  return {
    auth: {
      getUser: async () => ({ data: { user: opts.user }, error: null }),
    },
    from: (table: string) => {
      if (table !== 'comenzi') throw new Error('expected comenzi')
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              opts.fetchError != null
                ? { data: null, error: opts.fetchError }
                : { data: opts.fetchData, error: null },
          }),
        }),
        update: () => {
          const query = {
            eq: () => query,
            is: () => query,
            select: async () =>
              opts.updateError != null
                ? { data: null, error: opts.updateError }
                : { data: opts.updateData, error: null },
          }
          return query
        },
      }
    },
  }
}

describe('PATCH /api/association/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCH status valid pentru comandă magazin_asociatie → 200', async () => {
    getAssociationRole.mockResolvedValue('moderator')
    const updated = [{ id: OID }]
    orderMocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: UID } }, error: null }) },
    })
    orderMocks.getSupabaseAdmin.mockReturnValue(
      buildOrdersApi({
        user: null,
        fetchData: { id: OID, data_origin: 'magazin_asociatie', data_comanda: '2026-04-04' },
        updateData: updated,
      }),
    )
    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, status: 'confirmata' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const j = (await res.json()) as { ok: boolean }
    expect(j.ok).toBe(true)
  })

  it('PATCH pe comandă cu alt data_origin → 403', async () => {
    getAssociationRole.mockResolvedValue('admin')
    orderMocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: UID } }, error: null }) },
    })
    orderMocks.getSupabaseAdmin.mockReturnValue(
      buildOrdersApi({
        user: null,
        fetchData: { id: OID, data_origin: 'magazin_public' },
        updateData: null,
      }),
    )
    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, status: 'confirmata' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })

  it('PATCH fără auth → 401', async () => {
    orderMocks.createClient.mockResolvedValue(
      { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
    )
    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, status: 'confirmata' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })
})
