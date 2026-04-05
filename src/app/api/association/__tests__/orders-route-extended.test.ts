import { describe, expect, it, vi, beforeEach } from 'vitest'

import { PATCH } from '@/app/api/association/orders/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const createNotificationForTenantOwner = vi.fn()
vi.mock('@/lib/notifications/create', () => ({
  createNotificationForTenantOwner: (...a: unknown[]) => createNotificationForTenantOwner(...a),
  NOTIFICATION_TYPES: { order_status_changed: 'order_status_changed' },
}))

const getAssociationRole = vi.fn()
vi.mock('@/lib/association/auth', () => ({
  getAssociationRole: (uid: string) => getAssociationRole(uid),
}))

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

const OID = '880e8400-e29b-41d4-a716-446655440001'
const UID = '880e8400-e29b-41d4-a716-446655440002'
const TID = '880e8400-e29b-41d4-a716-446655440003'

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

describe('PATCH /api/association/orders — extended', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('200: status noua → confirmata', async () => {
    getAssociationRole.mockResolvedValue('admin')
    const updated = [{ id: OID }]
    orderMocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: UID } }, error: null }) },
    })
    orderMocks.getSupabaseAdmin.mockReturnValue(
      buildOrdersApi({
        user: null,
        fetchData: {
          id: OID,
          data_origin: 'magazin_asociatie',
          tenant_id: TID,
          status: 'noua',
          data_comanda: '2026-04-04',
        },
        updateData: updated,
      }),
    )
    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, status: 'confirmata' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(createNotificationForTenantOwner).toHaveBeenCalled()
  })

  it('400: status invalid (schema)', async () => {
    getAssociationRole.mockResolvedValue('moderator')
    orderMocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: UID } }, error: null }) },
    })
    orderMocks.getSupabaseAdmin.mockReturnValue(
      buildOrdersApi({
        user: null,
        fetchData: {
          id: OID,
          data_origin: 'magazin_asociatie',
          tenant_id: TID,
          status: 'noua',
        },
        updateData: null,
      }),
    )
    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, status: 'invalid_status' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('403: data_origin magazin_public', async () => {
    getAssociationRole.mockResolvedValue('admin')
    orderMocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: UID } }, error: null }) },
    })
    orderMocks.getSupabaseAdmin.mockReturnValue(
      buildOrdersApi({
        user: null,
        fetchData: { id: OID, data_origin: 'magazin_public', tenant_id: TID, status: 'noua' },
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

  it('403: viewer', async () => {
    getAssociationRole.mockResolvedValue('viewer')
    orderMocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: UID } }, error: null }) },
    })
    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, status: 'confirmata' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })

  it('200: moderator poate actualiza', async () => {
    getAssociationRole.mockResolvedValue('moderator')
    const updated = [{ id: OID }]
    orderMocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: UID } }, error: null }) },
    })
    orderMocks.getSupabaseAdmin.mockReturnValue(
      buildOrdersApi({
        user: null,
        fetchData: {
          id: OID,
          data_origin: 'magazin_asociatie',
          tenant_id: TID,
          status: 'noua',
          data_comanda: '2026-04-04',
        },
        updateData: updated,
      }),
    )
    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, status: 'programata' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })
})
