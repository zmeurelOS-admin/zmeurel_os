import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PATCH } from '@/app/api/association/orders/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const getAssociationRole = vi.fn()
vi.mock('@/lib/association/auth', () => ({
  getAssociationRole: (uid: string) => getAssociationRole(uid),
}))

const OID = '880e8400-e29b-41d4-a716-446655440001'
const LID = '880e8400-e29b-41d4-a716-446655440010'
const UID = '880e8400-e29b-41d4-a716-446655440002'

const orderMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => orderMocks.createClient(),
}))

function buildOrdersClient(opts: {
  user: { id: string } | null
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
      getUser: async () => ({ data: { user: opts.user }, error: null }),
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

describe('PATCH /api/association/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('actualizează statusul pentru o comandă din magazinul asociației', async () => {
    getAssociationRole.mockResolvedValue('moderator')
    orderMocks.createClient.mockResolvedValue(
      buildOrdersClient({
        user: { id: UID },
        fetchData: [{ id: OID, data_origin: 'magazin_asociatie', status: 'noua' }],
        updateData: [{ id: OID, tenant_id: 'tenant-1' }],
      }),
    )

    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, lineIds: [OID], status: 'confirmata' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      data: { id: OID, status: 'confirmata' },
    })
  })

  it('respinge comenzi din altă sursă', async () => {
    getAssociationRole.mockResolvedValue('admin')
    orderMocks.createClient.mockResolvedValue(
      buildOrdersClient({
        user: { id: UID },
        fetchData: [{ id: OID, data_origin: 'magazin_public', status: 'noua' }],
        updateData: null,
      }),
    )

    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, lineIds: [OID], status: 'confirmata' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(403)
  })

  it('cere autentificare', async () => {
    orderMocks.createClient.mockResolvedValue(buildOrdersClient({ user: null, fetchData: [], updateData: null }))

    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, lineIds: [OID], status: 'confirmata' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(401)
  })

  it('cere toate lineIds pentru grupul selectat', async () => {
    getAssociationRole.mockResolvedValue('admin')
    orderMocks.createClient.mockResolvedValue(
      buildOrdersClient({
        user: { id: UID },
        fetchData: [{ id: OID, data_origin: 'magazin_asociatie', status: 'noua' }],
        updateData: null,
      }),
    )

    const req = createSameOriginRequest('/api/association/orders', {
      method: 'PATCH',
      json: { orderId: OID, lineIds: [OID, LID], status: 'confirmata' },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(400)
  })
})
