import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PATCH } from '@/app/api/association/orders/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const createNotificationForTenantOwner = vi.fn()
vi.mock('@/lib/notifications/create', () => ({
  createNotificationForTenantOwner: (...args: unknown[]) => createNotificationForTenantOwner(...args),
  NOTIFICATION_TYPES: { order_status_changed: 'order_status_changed' },
}))

const getAssociationRole = vi.fn()
vi.mock('@/lib/association/auth', () => ({
  getAssociationRole: (uid: string) => getAssociationRole(uid),
}))

const orderMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => orderMocks.createClient(),
}))

const OID = '880e8400-e29b-41d4-a716-446655440001'
const L1 = '880e8400-e29b-41d4-a716-446655440011'
const L2 = '880e8400-e29b-41d4-a716-446655440012'
const UID = '880e8400-e29b-41d4-a716-446655440002'
const T1 = '880e8400-e29b-41d4-a716-446655440101'
const T2 = '880e8400-e29b-41d4-a716-446655440102'

function buildOrdersClient(opts: {
  user?: { id: string } | null
  fetchData: Array<{
    id: string
    data_origin: string | null
    tenant_id?: string | null
    status?: string
    note_interne?: string | null
  }>
  fetchError?: unknown
  updateData: Array<{ id: string; tenant_id?: string | null }> | null
  updateError?: unknown
}) {
  return {
    auth: {
      getUser: async () => ({ data: { user: opts.user ?? { id: UID } }, error: null }),
    },
    from: (table: string) => {
      if (table !== 'comenzi') throw new Error('expected comenzi')
      return {
        select: () => ({
          in: async () =>
            opts.fetchError != null
              ? { data: null, error: opts.fetchError }
              : { data: opts.fetchData, error: null },
        }),
        update: () => {
          const query = {
            in: () => query,
            eq: () => query,
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

describe('PATCH /api/association/orders — tranziții și grupuri', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('acceptă noua -> confirmata și notifică toți producătorii afectați', async () => {
    getAssociationRole.mockResolvedValue('admin')
    orderMocks.createClient.mockResolvedValue(
      buildOrdersClient({
        fetchData: [
          { id: OID, data_origin: 'magazin_asociatie', tenant_id: T1, status: 'noua' },
          { id: L1, data_origin: 'magazin_asociatie', tenant_id: T2, status: 'noua' },
        ],
        updateData: [
          { id: OID, tenant_id: T1 },
          { id: L1, tenant_id: T2 },
        ],
      }),
    )

    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, lineIds: [OID, L1], status: 'confirmata' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(createNotificationForTenantOwner).toHaveBeenCalledTimes(2)
  })

  it('respinge status invalid din schemă', async () => {
    getAssociationRole.mockResolvedValue('moderator')
    orderMocks.createClient.mockResolvedValue(buildOrdersClient({ fetchData: [], updateData: null }))

    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, lineIds: [OID], status: 'invalid_status' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(400)
  })

  it('respinge tranziție confirmata -> livrata', async () => {
    getAssociationRole.mockResolvedValue('moderator')
    orderMocks.createClient.mockResolvedValue(
      buildOrdersClient({
        fetchData: [{ id: OID, data_origin: 'magazin_asociatie', tenant_id: T1, status: 'confirmata' }],
        updateData: null,
      }),
    )

    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, lineIds: [OID], status: 'livrata' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(400)
  })

  it('respinge grupuri cu statusuri mixte', async () => {
    getAssociationRole.mockResolvedValue('admin')
    orderMocks.createClient.mockResolvedValue(
      buildOrdersClient({
        fetchData: [
          { id: OID, data_origin: 'magazin_asociatie', tenant_id: T1, status: 'noua' },
          { id: L2, data_origin: 'magazin_asociatie', tenant_id: T1, status: 'confirmata' },
        ],
        updateData: null,
      }),
    )

    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, lineIds: [OID, L2], status: 'confirmata' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(409)
  })

  it('viewer nu poate actualiza', async () => {
    getAssociationRole.mockResolvedValue('viewer')
    orderMocks.createClient.mockResolvedValue(buildOrdersClient({ fetchData: [], updateData: null }))

    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, lineIds: [OID], status: 'confirmata' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(403)
  })
})
